import { defineMessages } from '../define';

type D = Record<string, string | number | null>;
const s = (v: unknown) => (v == null ? '' : String(v));

/** Request statuses arrive as raw values (e.g. "fulfilled"); show them as words. */
const REQUEST_STATUS_BN: Record<string, string> = {
  open: 'খোলা',
  in_progress: 'কাজ চলছে',
  fulfilled: 'রক্ত পাওয়া গেছে',
  cancelled: 'বাতিল',
  expired: 'মেয়াদ শেষ',
};
const REQUEST_STATUS_EN: Record<string, string> = {
  open: 'open',
  in_progress: 'in progress',
  fulfilled: 'blood found',
  cancelled: 'cancelled',
  expired: 'expired',
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Calendar dates arrive as "YYYY-MM-DD"; anything else is shown as given. */
function day(value: unknown, locale: 'bn' | 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(value));
  if (!m) return s(value);
  const month = Number(m[2]) - 1;
  if (locale === 'en') return `${Number(m[3])} ${EN_MONTHS[month] ?? m[2]} ${m[1]}`;
  const digits = (text: string) => text.replace(/\d/g, (c) => BN_DIGITS[Number(c)]);
  return `${digits(String(Number(m[3])))} ${BN_MONTHS[month] ?? m[2]} ${digits(m[1])}`;
}

export const notifications = defineMessages({
  bn: {
    title: 'নোটিফিকেশন',
    empty: 'এখনো কোনো নোটিফিকেশন নেই।',
    unread: (n: string) => `${n}টি নতুন`,
    fallbackTitle: 'নতুন নোটিফিকেশন',
    externalNotConfigured: 'এসএমএস বা ইমেইল পাঠানোর ব্যবস্থা এখনো চালু হয়নি, তাই নোটিফিকেশন শুধু এই ওয়েবসাইটেই দেখা যাবে।',
    kinds: {
      contact_request_received: { title: 'নতুন যোগাযোগের অনুরোধ', body: (d: D) => `${s(d.requester)} আপনার সাথে যোগাযোগ করতে চান। অনুরোধটি দেখে উত্তর দিন।` },
      contact_request_accepted: { title: 'রক্তদাতা যোগাযোগে রাজি হয়েছেন', body: (d: D) => `${s(d.donor)} আপনার অনুরোধে রাজি হয়েছেন। এখন তাঁর যোগাযোগের তথ্য দেখতে পারবেন।` },
      contact_request_declined: { title: 'রক্তদাতা এখন পারছেন না', body: (d: D) => `${s(d.donor)} এই মুহূর্তে সাহায্য করতে পারছেন না। অন্য রক্তদাতা খুঁজুন, বা কোনো সংগঠনের সাহায্য নিন।` },
      donation_verified: { title: 'রক্তদান যাচাই হয়েছে', body: (d: D) => `${day(d.date, 'bn')} তারিখের রক্তদানটি যাচাই করা হয়েছে।` },
      donation_rejected: { title: 'রক্তদান যাচাই করা যায়নি', body: (d: D) => `${day(d.date, 'bn')} তারিখের রক্তদানটি যাচাই করা যায়নি। বিস্তারিত রক্তদানের ইতিহাসে দেখুন।` },
      donor_verified: { title: 'প্রোফাইল যাচাই হয়েছে', body: () => 'আপনার রক্তদাতা প্রোফাইল যাচাই করা হয়েছে।' },
      membership_approved: { title: 'সদস্য হওয়ার আবেদন অনুমোদিত', body: (d: D) => `আপনি এখন ${s(d.community)}-এর সদস্য।` },
      membership_rejected: { title: 'সদস্য হওয়ার আবেদন অনুমোদন পায়নি', body: (d: D) => `${s(d.community)} আপনার আবেদনটি অনুমোদন করেনি।` },
      membership_requested: { title: 'সদস্য হওয়ার নতুন আবেদন', body: (d: D) => `${s(d.name)} ${s(d.community)}-এ যোগ দিতে চান।` },
      community_approved: { title: 'সংগঠন অনুমোদন পেয়েছে', body: (d: D) => `${s(d.community)} এখন অনুমোদিত। এবার সংগঠন পরিচালনা শুরু করতে পারেন।` },
      community_suspended: { title: 'সংগঠন স্থগিত করা হয়েছে', body: (d: D) => `${s(d.community)} সাময়িকভাবে স্থগিত করা হয়েছে।` },
      community_rejected: { title: 'সংগঠনের আবেদন অনুমোদন পায়নি', body: (d: D) => `${s(d.community)}-এর আবেদন অনুমোদন পায়নি।` },
      request_assigned: { title: 'রক্তের অনুরোধ আপনাদের দায়িত্বে', body: (d: D) => `${s(d.group)} রক্তের একটি অনুরোধ (${s(d.place)}) আপনাদের সংগঠনকে দেওয়া হয়েছে।` },
      request_escalated: { title: 'আরেকটি সংগঠন সাহায্য চাইছে', body: (d: D) => `${s(d.group)} রক্তের একটি অনুরোধ (${s(d.place)}) আপনাদের কাছে পাঠানো হয়েছে।` },
      request_response: { title: 'একজন রক্তদাতা সাড়া দিয়েছেন', body: (d: D) => `${s(d.group)} রক্তের অনুরোধে একজন রক্তদাতা সাহায্য করতে চেয়েছেন। এখনো নিশ্চিত নয় — কথা বলে নিশ্চিত হয়ে নিন।` },
      request_status_changed: { title: 'অনুরোধের অবস্থা বদলেছে', body: (d: D) => `অনুরোধের নতুন অবস্থা: ${REQUEST_STATUS_BN[s(d.status)] ?? s(d.status)}` },
      availability_expiring: { title: 'এখনো কি রক্ত দিতে পারবেন?', body: () => 'আপনার "পারব" তথ্যের মেয়াদ শেষ হয়েছে। এখন পারবেন কি না, আবার জানিয়ে দিন।' },
      deletion_completed: { title: 'অ্যাকাউন্ট মুছে ফেলা হয়েছে', body: () => 'আপনার অনুরোধ অনুযায়ী তথ্য মুছে ফেলা হয়েছে।' },
      registration_approved: {
        title: 'আপনার নিবন্ধন অনুমোদিত হয়েছে',
        body: () => 'আপনি এখন রক্তদাতার তালিকায় আছেন। রক্ত দিতে পারলে "পারব" জানিয়ে রাখুন — তাহলেই রক্তদাতা খোঁজার ফলাফলে আপনাকে দেখা যাবে।',
      },
      registration_rejected: {
        title: 'আপনার নিবন্ধন অনুমোদন পায়নি',
        body: (d: D) => `কারণ: ${s(d.reason) || 'উল্লেখ করা হয়নি'}। তথ্য ঠিক করে আবার জমা দিতে পারেন।`,
      },
      availability_changed_by_staff: {
        title: 'রক্ত দিতে পারবেন কি না — অ্যাডমিন হালনাগাদ করেছেন',
        body: (d: D) => `এখন দেখানো হচ্ছে: ${s(d.status)}। ঠিক না হলে অ্যাকাউন্ট থেকে নিজে বদলে দিন।`,
      },
      listing_changed_by_staff: {
        title: 'তালিকায় আপনার প্রোফাইলের অবস্থা বদলেছে',
        body: (d: D) => `নতুন অবস্থা: ${s(d.status)}। প্রশ্ন থাকলে যোগাযোগ পাতা থেকে আমাদের জানান।`,
      },
      profile_changed_by_staff: {
        title: 'আপনার প্রোফাইলের তথ্য সংশোধন করা হয়েছে',
        body: () => 'অ্যাডমিন আপনার প্রোফাইলের কিছু তথ্য হালনাগাদ করেছেন। একবার দেখে নিন, ভুল থাকলে ঠিক করে দিন।',
      },
    },
  },
  en: {
    title: 'Notifications',
    empty: 'No notifications yet.',
    unread: (n: string) => `${n} new`,
    fallbackTitle: 'New notification',
    externalNotConfigured: 'SMS and email sending is not set up yet, so notifications are shown on this website only.',
    kinds: {
      contact_request_received: { title: 'New contact request', body: (d: D) => `${s(d.requester)} would like to contact you. Please look at the request and reply.` },
      contact_request_accepted: { title: 'A donor agreed to be contacted', body: (d: D) => `${s(d.donor)} agreed to your request. You can now see their contact details.` },
      contact_request_declined: { title: 'The donor cannot help right now', body: (d: D) => `${s(d.donor)} cannot help at the moment. Try other donors or ask an organisation for help.` },
      donation_verified: { title: 'Donation verified', body: (d: D) => `Your donation on ${day(d.date, 'en')} has been verified.` },
      donation_rejected: { title: 'Donation could not be verified', body: (d: D) => `Your donation on ${day(d.date, 'en')} could not be verified. See your donation history for details.` },
      donor_verified: { title: 'Profile verified', body: () => 'Your donor profile has been verified.' },
      membership_approved: { title: 'Membership approved', body: (d: D) => `You are now a member of ${s(d.community)}.` },
      membership_rejected: { title: 'Membership not approved', body: (d: D) => `${s(d.community)} did not approve your application.` },
      membership_requested: { title: 'New membership application', body: (d: D) => `${s(d.name)} wants to join ${s(d.community)}.` },
      community_approved: { title: 'Organisation approved', body: (d: D) => `${s(d.community)} is now approved. You can start managing it.` },
      community_suspended: { title: 'Organisation suspended', body: (d: D) => `${s(d.community)} has been suspended for now.` },
      community_rejected: { title: 'Organisation application not approved', body: (d: D) => `The application for ${s(d.community)} was not approved.` },
      request_assigned: { title: 'A blood request is now your responsibility', body: (d: D) => `A request for ${s(d.group)} blood (${s(d.place)}) was assigned to your organisation.` },
      request_escalated: { title: 'Another organisation needs help', body: (d: D) => `A request for ${s(d.group)} blood (${s(d.place)}) was passed to your organisation.` },
      request_response: { title: 'A donor responded', body: (d: D) => `A donor offered to help with a ${s(d.group)} blood request. This is not confirmed yet — please talk to them first.` },
      request_status_changed: { title: 'Request status changed', body: (d: D) => `New status: ${REQUEST_STATUS_EN[s(d.status)] ?? s(d.status)}` },
      availability_expiring: { title: 'Can you still donate?', body: () => 'Your “available” status has expired. Please tell us again whether you can donate now.' },
      deletion_completed: { title: 'Account deleted', body: () => 'Your information has been deleted as you asked.' },
      registration_approved: {
        title: 'Your registration was approved',
        body: () => 'You are now on the donor list. Mark yourself as available when you can donate, so people searching for donors can find you.',
      },
      registration_rejected: {
        title: 'Your registration was not approved',
        body: (d: D) => `Reason: ${s(d.reason) || 'not given'}. You can correct your details and submit them again.`,
      },
      availability_changed_by_staff: {
        title: 'An administrator updated whether you can donate',
        body: (d: D) => `Now shown: ${s(d.status)}. If this is wrong, change it yourself from your account.`,
      },
      listing_changed_by_staff: {
        title: 'Your listing status changed',
        body: (d: D) => `New status: ${s(d.status)}. If you have questions, contact us through the contact page.`,
      },
      profile_changed_by_staff: {
        title: 'Your profile details were corrected',
        body: () => 'An administrator updated some details in your profile. Please check them and correct anything that is wrong.',
      },
    },
  },
});
