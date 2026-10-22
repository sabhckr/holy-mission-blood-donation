import { defineMessages } from '../define';

type Section = { heading: string; body: string[] };

export const legal = defineMessages({
  bn: {
    title: 'আইনি তথ্য',
    updated: (date: string) => `সর্বশেষ হালনাগাদ: ${date}`,
    contactTitle: 'যোগাযোগ',
    contactIntro: 'প্রশ্ন, অভিযোগ বা তথ্য সংশোধনের জন্য আমাদের সাথে যোগাযোগ করুন।',
    contactEmail: 'ইমেইল',
    contactPhone: 'ফোন',
    contactNotPublished: 'অ্যাডমিনরা এখনো সরাসরি যোগাযোগের নম্বর বা ইমেইল প্রকাশ করেননি। ততদিন নিচের উপায়গুলো ব্যবহার করুন।',
    contactWays: [
      'কোনো প্রোফাইল, সংগঠন বা অনুরোধে ভুল তথ্য বা অপব্যবহার দেখলে সেই পাতার "ভুল তথ্য বা অপব্যবহার জানান" ব্যবহার করুন — সরাসরি অ্যাডমিনের কাছে যায়।',
      'আপনার এলাকার অনুমোদিত সংগঠনের সমন্বয়কের সাথে সংগঠনের পাতা থেকে যোগাযোগ করুন।',
      'নিজের তথ্য দেখতে, বদলাতে বা মুছে ফেলতে লগ ইন করে "আমার অ্যাকাউন্ট" ব্যবহার করুন।',
    ],
    contactEmergency: 'জরুরি চিকিৎসার জন্য এই পাতা নয় — হাসপাতাল বা ব্লাড ব্যাংকে যোগাযোগ করুন।',
    privacyTitle: 'গোপনীয়তা নীতি',
    privacyIntro: 'আমরা কী তথ্য রাখি, কেন রাখি, কে দেখতে পায় আর আপনি কী করতে পারেন — সহজ ভাষায়।',
    privacySections: [
      { heading: 'আমরা কী তথ্য রাখি', body: ['অ্যাকাউন্ট: নাম, মোবাইল নম্বর, (ঐচ্ছিক) ইমেইল, পাসওয়ার্ডের নিরাপদ হ্যাশ।', 'রক্তদাতা প্রোফাইল: পুরো নাম, জন্মতারিখ, রক্তের গ্রুপ, বিভাগ/জেলা/উপজেলা, এলাকার নাম, যোগাযোগের নম্বর ও পছন্দ, রক্তদানের রেকর্ড, প্রস্তুত থাকার তথ্য।', 'রক্তের অনুরোধ: অনুরোধকারীর নাম ও নম্বর, হাসপাতালের নাম, গ্রুপ, পরিমাণ, সময় আর একটি ছোট নোট। আমরা রোগীর রোগের বিবরণ বা পরিচয়পত্র চাই না।'] },
      { heading: 'আমরা কী রাখি না', body: ['আমরা আপনার লাইভ অবস্থান (GPS) ট্র্যাক করি না। পুরো বাড়ির ঠিকানা চাই না। আইপি ঠিকানা সরাসরি রাখি না — শুধু অপব্যবহার ঠেকাতে একটি এনক্রিপ্টেড হ্যাশ রাখি।'] },
      { heading: 'কে কী দেখে', body: ['প্রতিটি তথ্য কে দেখবে, রক্তদাতা নিজেই ঠিক করেন: সবাই, লগ ইন করা ব্যবহারকারী, শুধু অনুমোদিত সংগঠনের সমন্বয়ক, বা শুধু নিজে।', 'লগ ইন ছাড়া কেউ কখনো ফোন নম্বর দেখতে পারে না। প্রতিবার নম্বর দেখা রেকর্ড করা হয়।', 'জন্মতারিখ কখনো প্রকাশ করা হয় না। সমন্বয়করা শুধু বয়স দেখেন।', 'প্ল্যাটফর্ম অ্যাডমিনরা নিরাপত্তা ও অপব্যবহার রোধে অ্যাকাউন্টের তথ্য দেখতে পারেন; প্রতিটি দেখা রেকর্ড করা হয়।'] },
      { heading: 'আপনার অধিকার', body: ['নিজের তথ্য দেখা ও সংশোধন: "আমার অ্যাকাউন্ট" থেকে।', 'তালিকা থেকে সরে থাকা: যেকোনো সময় "খোঁজার তালিকায় দেখান" বন্ধ করুন বা প্রোফাইল সাময়িক বন্ধ রাখুন।', 'অ্যাকাউন্ট নিষ্ক্রিয় করা বা মুছে ফেলার অনুরোধ: "নিরাপত্তা" পাতা থেকে। মুছে ফেলার অনুরোধ অ্যাডমিন প্রক্রিয়া করলে রক্তদাতা প্রোফাইল, রক্তদানের রেকর্ড, সদস্যপদ ও নোটিফিকেশন মুছে যায়, আর অনুরোধে থাকা আপনার নাম-নম্বর সরিয়ে ফেলা হয়।'] },
      { heading: 'কতদিন রাখি', body: ['আপনি অ্যাকাউন্ট রাখা পর্যন্ত তথ্য রাখা হয়। পুরোনো লগ ইন সেশন আর অপব্যবহার ঠেকানোর গণনা নিয়মিত মুছে ফেলা হয়। নিরাপত্তা লগে ফোন নম্বর বা পাসওয়ার্ড থাকে না।'] },
      { heading: 'নিরাপত্তা', body: ['পাসওয়ার্ড শক্তিশালী হ্যাশ (scrypt) করে রাখা হয়। লগ ইন কুকি শুধু সার্ভার পড়তে পারে। গুরুত্বপূর্ণ প্রতিটি কাজ সার্ভারে অনুমতি যাচাই করে করা হয় এবং রেকর্ড রাখা হয়।'] },
    ] as Section[],
    termsTitle: 'ব্যবহারের শর্ত',
    termsIntro: 'এই ওয়েবসাইট ব্যবহার করলে নিচের শর্তগুলো মেনে চলবেন।',
    termsSections: [
      { heading: 'এই ওয়েবসাইট কী', body: ['হলি মিশন ব্লাড ডোনেশন একটি কমিউনিটি উদ্যোগ, যা স্বেচ্ছায় রক্তদাতা, রক্তগ্রহীতা আর রক্তদান সংগঠনকে যোগাযোগ করিয়ে দেয়। এটি হাসপাতাল, ব্লাড ব্যাংক বা চিকিৎসাসেবা নয়।'] },
      { heading: 'চিকিৎসা সংক্রান্ত সতর্কতা', body: ['এখানে দেখানো "প্রস্তুত" অবস্থা বা "আবার রক্ত দেওয়ার আনুমানিক তারিখ" চিকিৎসাগত যোগ্যতার প্রমাণ নয়। রক্ত দেওয়া-নেওয়ার আগে অবশ্যই হাসপাতাল বা লাইসেন্সপ্রাপ্ত ব্লাড ব্যাংকে পরীক্ষা করাতে হবে।'] },
      { heading: 'আপনার দায়িত্ব', body: ['সঠিক তথ্য দিন। অন্যের নামে অ্যাকাউন্ট খুলবেন না।', 'রক্তদাতাদের নম্বর শুধু রক্তের প্রয়োজনে ব্যবহার করুন — বিজ্ঞাপন, হয়রানি বা তথ্য সংগ্রহের জন্য নয়।', 'রক্তের বিনিময়ে টাকা চাওয়া বা দেওয়া নিষিদ্ধ।'] },
      { heading: 'আমরা যা নিশ্চয়তা দিতে পারি না', body: ['আমরা কোনো রক্তদাতার পাওয়া বা রক্ত দেওয়ার নিশ্চয়তা দিতে পারি না। রক্তদাতা সাড়া দিলেও তিনি রাজি হয়েছেন — এমন ধরে নেবেন না, আগে কথা বলে নিশ্চিত হোন।'] },
      { heading: 'অপব্যবহার', body: ['নিয়ম ভাঙলে অ্যাডমিন অ্যাকাউন্ট বা প্রোফাইল স্থগিত করতে পারেন। সংগঠনের অনুমোদনও স্থগিত হতে পারে।'] },
    ] as Section[],
  },
  en: {
    title: 'Legal information',
    updated: (date: string) => `Last updated: ${date}`,
    contactTitle: 'Contact',
    contactIntro: 'Get in touch with questions, complaints or corrections.',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    contactNotPublished: 'The administrators have not published a direct phone number or email yet. Until then, please use the options below.',
    contactWays: [
      'If you see wrong information or misuse on a profile, community or request, use "Report wrong information or misuse" on that page — it goes straight to the administrators.',
      'Contact a coordinator of an approved community in your area from the community’s page.',
      'To see, change or delete your own information, sign in and use "My account".',
    ],
    contactEmergency: 'This page is not for medical emergencies — contact a hospital or blood bank.',
    privacyTitle: 'Privacy policy',
    privacyIntro: 'What we keep, why, who can see it, and what you can do — in plain words.',
    privacySections: [
      { heading: 'What we keep', body: ['Account: name, mobile number, (optional) email, a secure hash of your password.', 'Donor profile: full name, date of birth, blood group, division/district/upazila, area name, contact number and preference, donation records, availability.', 'Blood requests: requester name and number, hospital name, group, quantity, time and a short note. We do not ask for diagnoses or identity documents.'] },
      { heading: 'What we do not keep', body: ['We do not track your live location (GPS). We do not ask for your full home address. We do not store IP addresses directly — only a keyed hash used to prevent abuse.'] },
      { heading: 'Who sees what', body: ['Donors choose who can see each piece of information: everyone, signed-in users, approved community coordinators only, or only themselves.', 'Nobody can ever see a phone number without signing in. Every number view is recorded.', 'Dates of birth are never published. Coordinators only see age.', 'Platform administrators can see account details for safety and abuse prevention; every such view is recorded.'] },
      { heading: 'Your rights', body: ['See and correct your information from "My account".', 'Stay out of search at any time by turning off "Show me in donor search" or pausing your profile.', 'Deactivate your account or request deletion from the "Security" page. When an administrator processes a deletion request, your donor profile, donation records, memberships and notifications are deleted, and your name and number are removed from your blood requests.'] },
      { heading: 'How long we keep it', body: ['Information is kept while you keep your account. Old sign-in sessions and abuse-prevention counters are removed regularly. Security logs never contain phone numbers or passwords.'] },
      { heading: 'Security', body: ['Passwords are stored with a strong hash (scrypt). The sign-in cookie can only be read by the server. Every important action is permission-checked on the server and recorded.'] },
    ] as Section[],
    termsTitle: 'Terms of use',
    termsIntro: 'By using this website you agree to the following.',
    termsSections: [
      { heading: 'What this website is', body: ['Holy Mission Blood Donation is a community initiative that connects voluntary blood donors, people who need blood, and blood donation communities. It is not a hospital, blood bank or medical service.'] },
      { heading: 'Medical caution', body: ['The "available" status and the "estimated next donation date" shown here are not proof of medical eligibility. Blood must always be tested at a hospital or licensed blood bank before transfusion.'] },
      { heading: 'Your responsibilities', body: ['Give true information. Do not create accounts in someone else’s name.', 'Use donors’ numbers only for blood needs — not for advertising, harassment or collecting data.', 'Asking for or paying money for blood is not allowed.'] },
      { heading: 'What we cannot promise', body: ['We cannot guarantee that a donor will be found or will donate. Even if a donor responds, do not assume they have agreed — talk to them first.'] },
      { heading: 'Misuse', body: ['Administrators may suspend accounts or profiles that break these rules. A community’s approval may also be suspended.'] },
    ] as Section[],
  },
});
