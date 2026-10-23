import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { notifications } from '@/server/db/schema';
import { bookingWindow } from '@/server/domain/booking';
import { addDays, bangladeshDateTimeToInstant } from '@/server/domain/dates';
import {
  changeRequestStatus,
  createBloodRequest,
  getRequestForViewer,
  respondToRequest,
  setResponseStatus,
  type BloodRequestInput,
} from '@/server/services/requests';
import { makeDonor, nextPhone, place, resetDb } from './helpers';

beforeEach(resetDb);

async function requestOn(date: string, over: Partial<BloodRequestInput> = {}): Promise<BloodRequestInput> {
  const area = await place('Lakshmipur', 'Raipur');
  return {
    bloodGroup: 'O+',
    units: 1,
    ...area,
    hospitalName: 'Lakshmipur Sadar Hospital',
    neededAt: bangladeshDateTimeToInstant(date, '23:00'),
    urgency: 'normal',
    requesterName: 'Karim',
    requesterPhone: nextPhone(),
    contactPreference: 'call',
    sharePhoneWithResponders: false,
    note: null,
    showOnPublicBoard: true,
    communityId: null,
    ...over,
  };
}

/** A request with one donor's offer, returning what the requester needs to confirm it. */
async function requestWithOffer(date: string, donor: Awaited<ReturnType<typeof makeDonor>>) {
  const created = await createBloodRequest(null, await requestOn(date));
  await respondToRequest(donor.actor, created.request.publicId, null);
  const view = await getRequestForViewer(created.request.publicId, null, created.manageToken);
  return { ...created, responseId: view!.responses[0].id };
}

describe('booking window on the server', () => {
  it('accepts today and exactly 15 days ahead (Bangladesh time)', async () => {
    const { first, last } = bookingWindow();
    await expect(createBloodRequest(null, await requestOn(first))).resolves.toBeTruthy();
    await expect(createBloodRequest(null, await requestOn(last))).resolves.toBeTruthy();
  });

  it('refuses yesterday and 16 days ahead even if the form is bypassed', async () => {
    const { first, last } = bookingWindow();
    await expect(createBloodRequest(null, await requestOn(addDays(first, -1)))).rejects.toMatchObject({ fieldErrors: { neededDate: 'pastDate' } });
    await expect(createBloodRequest(null, await requestOn(addDays(last, 1)))).rejects.toMatchObject({ fieldErrors: { neededDate: 'tooFarAhead' } });
  });

  it('lets only one of two identical requests sent at the same time through', async () => {
    const input = await requestOn(bookingWindow().first);
    const results = await Promise.allSettled([createBloodRequest(null, input), createBloodRequest(null, input)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ messageKey: 'duplicate_request' });
  });
});

describe('confirming a donor', () => {
  it('tells the donor, and never books the same donor on two open requests', async () => {
    const donor = await makeDonor();
    const { first } = bookingWindow();
    const a = await requestWithOffer(first, donor);
    const b = await requestWithOffer(addDays(first, 3), donor);

    await setResponseStatus(null, a.request.publicId, a.responseId, 'confirmed', a.manageToken);
    const told = await db.select().from(notifications).where(and(eq(notifications.userId, donor.user.id), eq(notifications.kind, 'response_confirmed')));
    expect(told).toHaveLength(1);

    await expect(setResponseStatus(null, b.request.publicId, b.responseId, 'confirmed', b.manageToken)).rejects.toMatchObject({ messageKey: 'donor_already_booked' });
    // A new offer elsewhere is refused while the booking is open, too.
    const c = await createBloodRequest(null, await requestOn(addDays(first, 5)));
    await expect(respondToRequest(donor.actor, c.request.publicId, null)).rejects.toMatchObject({ messageKey: 'donor_already_booked' });

    // Once the first request is closed, the donor can be confirmed again.
    await changeRequestStatus(null, a.request.publicId, 'cancelled', null, a.manageToken);
    await setResponseStatus(null, b.request.publicId, b.responseId, 'confirmed', b.manageToken);
    expect((await getRequestForViewer(b.request.publicId, null, b.manageToken))?.responses[0].status).toBe('confirmed');
  });

  it('lets only one of two simultaneous confirmations of the same donor succeed', async () => {
    const donor = await makeDonor();
    const { first } = bookingWindow();
    const a = await requestWithOffer(first, donor);
    const b = await requestWithOffer(addDays(first, 1), donor);
    const results = await Promise.allSettled([
      setResponseStatus(null, a.request.publicId, a.responseId, 'confirmed', a.manageToken),
      setResponseStatus(null, b.request.publicId, b.responseId, 'confirmed', b.manageToken),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ messageKey: 'donor_already_booked' });
  });

  it('refuses a donor whose own records say they cannot give again by that date', async () => {
    const { first } = bookingWindow();
    const recent = await makeDonor({ lastDonation: { date: addDays(first, -10), type: 'whole_blood' } });
    const { request } = await createBloodRequest(null, await requestOn(addDays(first, 15)));
    await expect(respondToRequest(recent.actor, request.publicId, null)).rejects.toMatchObject({ messageKey: 'not_eligible_by_date' });
    const rested = await makeDonor({ lastDonation: { date: addDays(first, -400), type: 'whole_blood' } });
    await expect(respondToRequest(rested.actor, request.publicId, null)).resolves.toBeUndefined();
  });

  it('cannot confirm or decline on a closed request, and a decline is also told to the donor', async () => {
    const donor = await makeDonor();
    const other = await makeDonor();
    const { first } = bookingWindow();
    const a = await requestWithOffer(first, donor);
    await respondToRequest(other.actor, a.request.publicId, null);
    const view = await getRequestForViewer(a.request.publicId, null, a.manageToken);
    const otherResponse = view!.responses.find((r) => r.id !== a.responseId)!;
    await setResponseStatus(null, a.request.publicId, otherResponse.id, 'declined', a.manageToken);
    expect(await db.select().from(notifications).where(and(eq(notifications.userId, other.user.id), eq(notifications.kind, 'response_declined')))).toHaveLength(1);
    await changeRequestStatus(null, a.request.publicId, 'fulfilled', null, a.manageToken);
    await expect(setResponseStatus(null, a.request.publicId, a.responseId, 'confirmed', a.manageToken)).rejects.toMatchObject({ code: 'invalid_state' });
  });

  it('never shows the requester’s contact details to the public or to an offering donor without consent', async () => {
    const donor = await makeDonor();
    const { first } = bookingWindow();
    const a = await requestWithOffer(first, donor);
    const publicView = await getRequestForViewer(a.request.publicId, null);
    expect(publicView?.request.requesterPhone).toBeNull();
    expect(publicView?.request.requesterName).toBeNull();
    expect(publicView?.responses).toEqual([]);
    const donorView = await getRequestForViewer(a.request.publicId, donor.actor);
    expect(donorView?.request.requesterPhone).toBeNull();
  });
});
