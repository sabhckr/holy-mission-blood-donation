import { defineMessages } from '../define';

type Section = { heading: string; body: string[] };

export const legal = defineMessages({
  bn: {
    title: 'আইনি তথ্য',
    updated: (date: string) => `শেষ আপডেট: ${date}`,
    contactTitle: 'যোগাযোগ',
    tocLabel: 'এই পাতায় যা আছে',
    contactDirectTitle: 'সরাসরি যোগাযোগ',
    contactWaysTitle: 'আরও যেভাবে সাহায্য পাবেন',
    contactIntro: 'কোনো প্রশ্ন বা অভিযোগ থাকলে, কিংবা কোনো ভুল তথ্য ঠিক করতে চাইলে আমাদের সাথে যোগাযোগ করুন।',
    contactEmail: 'ইমেইল',
    contactPhone: 'ফোন',
    contactNotPublished: 'আমাদের সরাসরি যোগাযোগের নম্বর বা ইমেইল এখনো দেওয়া হয়নি। ততদিন নিচের উপায়গুলো কাজে লাগান।',
    contactWays: [
      'কোনো প্রোফাইল, সংগঠন বা অনুরোধে ভুল তথ্য বা অপব্যবহার দেখলে সেই পাতার "ভুল তথ্য বা অপব্যবহার জানান" ব্যবহার করুন। এটি সরাসরি অ্যাডমিনের কাছে যায়।',
      'সংগঠনের পাতা থেকে আপনার এলাকার অনুমোদিত সংগঠনের সমন্বয়কের সাথে যোগাযোগ করুন।',
      'নিজের তথ্য দেখতে, বদলাতে বা মুছে ফেলতে লগ ইন করে "আমার অ্যাকাউন্ট" ব্যবহার করুন।',
    ],
    contactEmergency: 'জরুরি চিকিৎসার দরকার হলে এখানে নয়, সরাসরি হাসপাতাল বা ব্লাড ব্যাংকে যোগাযোগ করুন।',
    privacyTitle: 'গোপনীয়তা নীতি',
    privacyIntro: 'আমরা কী তথ্য রাখি, কেন রাখি, কে দেখতে পান আর আপনি কী করতে পারেন — সহজ ভাষায়।',
    privacySections: [
      {
        heading: 'আমরা কী তথ্য রাখি',
        body: [
          'অ্যাকাউন্ট: নাম, মোবাইল নম্বর, ইমেইল (না দিলেও চলে) আর পাসওয়ার্ডের একটি নিরাপদ হ্যাশ (আসল পাসওয়ার্ড নয়)।',
          'রক্তদাতা প্রোফাইল: পুরো নাম, জন্মতারিখ, রক্তের গ্রুপ, বিভাগ/জেলা/উপজেলা, এলাকার নাম, যোগাযোগের নম্বর, কীভাবে যোগাযোগ করলে সুবিধা, রক্তদানের ইতিহাস, আর রক্ত দিতে পারবেন কি না।',
          'রক্তের অনুরোধ: যিনি অনুরোধ করছেন তাঁর নাম ও নম্বর, হাসপাতালের নাম, রক্তের গ্রুপ, কয় ব্যাগ, কখন লাগবে আর একটি ছোট নোট। রোগীর অসুখের বিবরণ বা কোনো পরিচয়পত্র আমরা চাই না।',
        ],
      },
      { heading: 'আমরা কী রাখি না', body: ['আমরা আপনার লাইভ লোকেশন (GPS) দেখি না। বাড়ির পুরো ঠিকানাও চাই না। আপনার আইপি ঠিকানা সরাসরি রাখি না। অপব্যবহার ঠেকাতে শুধু তার একটি সুরক্ষিত হ্যাশ রাখি।'] },
      {
        heading: 'কে কী দেখতে পান',
        body: [
          'প্রতিটি তথ্য কে দেখবেন, তা রক্তদাতা নিজেই ঠিক করেন: সবাই, লগ ইন করা ব্যবহারকারীরা, শুধু অনুমোদিত সংগঠনের সমন্বয়করা, বা শুধু তিনি নিজে।',
          'নতুন রক্তদাতা নিবন্ধন করলেই খোঁজার তালিকায় আসেন, যদি তিনি তালিকায় থাকতে রাজি থাকেন। দরকার হলে অ্যাডমিন বা মডারেটর কারও তালিকা বন্ধ করতে পারেন।',
          'লগ ইন না করে কেউ কখনো ফোন নম্বর দেখতে পারেন না। প্রতিবার নম্বর দেখা রেকর্ড করা হয়।',
          'জন্মতারিখ কখনো কাউকে দেখানো হয় না। সমন্বয়করা শুধু বয়স দেখতে পান।',
          'নিরাপত্তার জন্য আর অপব্যবহার ঠেকাতে এই ওয়েবসাইটের অ্যাডমিনরা অ্যাকাউন্টের তথ্য দেখতে পারেন। প্রতিবার দেখা রেকর্ড করা হয়।',
        ],
      },
      {
        heading: 'আপনার অধিকার',
        body: [
          '"আমার অ্যাকাউন্ট" থেকে নিজের তথ্য দেখতে আর ঠিক করতে পারেন।',
          'যেকোনো সময় খোঁজের তালিকা থেকে সরে থাকতে পারেন: "রক্তদাতা খোঁজার তালিকায় আমাকে দেখান" বন্ধ করে দিন, অথবা প্রোফাইল কিছু দিনের জন্য বন্ধ রাখুন।',
          '"আমার অ্যাকাউন্ট"-এর নিরাপত্তা অংশ থেকে অ্যাকাউন্ট নিষ্ক্রিয় করতে বা মুছে ফেলার অনুরোধ করতে পারেন। অ্যাডমিন মুছে ফেলার কাজ শেষ করলে আপনার রক্তদাতা প্রোফাইল, রক্তদানের ইতিহাস, সদস্যপদ আর নোটিফিকেশন মুছে যায়। আপনার করা রক্তের অনুরোধগুলো থেকেও আপনার নাম ও নম্বর সরিয়ে ফেলা হয়।',
        ],
      },
      { heading: 'কত দিন রাখি', body: ['যত দিন আপনার অ্যাকাউন্ট থাকবে, তত দিন তথ্যও থাকবে। পুরোনো লগ ইন সেশন আর অপব্যবহার ঠেকানোর হিসাব নিয়মিত মুছে ফেলা হয়। নিরাপত্তার লগে কোনো ফোন নম্বর বা পাসওয়ার্ড রাখা হয় না।'] },
      { heading: 'নিরাপত্তা', body: ['পাসওয়ার্ড শক্তিশালী হ্যাশ (scrypt) করে রাখা হয়। লগ ইনের কুকি শুধু আমাদের সার্ভার পড়তে পারে। প্রতিটি গুরুত্বপূর্ণ কাজের আগে সার্ভারে অনুমতি যাচাই করা হয়, আর তার রেকর্ড রাখা হয়।'] },
    ] as Section[],
    termsTitle: 'ব্যবহারের শর্ত',
    termsIntro: 'এই ওয়েবসাইট ব্যবহার করলে আপনি নিচের শর্তগুলো মেনে নিচ্ছেন।',
    termsSections: [
      {
        heading: 'এই ওয়েবসাইট কী',
        body: [
          'হলি মিশন ব্লাড ডোনেশন একটি সামাজিক উদ্যোগ। এই ওয়েবসাইট স্বেচ্ছায় রক্তদাতা, যাঁদের রক্ত দরকার, আর রক্তদানের সংগঠনগুলোর মধ্যে যোগাযোগ করিয়ে দেয়। এটি কোনো হাসপাতাল, ব্লাড ব্যাংক বা চিকিৎসাসেবা নয়।',
          'এই ওয়েবসাইট শুধু লক্ষ্মীপুর জেলার জন্য। রক্তদাতা নিবন্ধন, রক্তদাতা খোঁজা, রক্তের অনুরোধ আর সংগঠন — সবই লক্ষ্মীপুরের ঠিকানায়।',
          'এখানে নিবন্ধিত স্বতন্ত্র সংগঠনগুলো হলি মিশনের শাখা নয়।',
        ],
      },
      { heading: 'চিকিৎসা নিয়ে সতর্কতা', body: ['এখানে দেখানো "রক্ত দিতে পারবেন" বা "আবার রক্ত দেওয়ার আনুমানিক তারিখ" দেখে বোঝা যায় না যে কেউ শারীরিকভাবে রক্ত দেওয়ার উপযুক্ত। রক্ত দেওয়া-নেওয়ার আগে হাসপাতাল বা লাইসেন্সপ্রাপ্ত ব্লাড ব্যাংকে অবশ্যই রক্ত পরীক্ষা করাতে হবে।'] },
      { heading: 'আপনার দায়িত্ব', body: ['সঠিক তথ্য দিন। অন্যের নামে অ্যাকাউন্ট খুলবেন না।', 'রক্তদাতার নম্বর শুধু রক্তের প্রয়োজনে ব্যবহার করুন — বিজ্ঞাপন, হয়রানি বা তথ্য সংগ্রহের জন্য নয়।', 'রক্তের বিনিময়ে টাকা চাওয়া বা দেওয়া নিষেধ।'] },
      { heading: 'যা আমরা নিশ্চিত করতে পারি না', body: ['রক্তদাতা পাওয়া যাবেই, বা তিনি রক্ত দেবেনই — এমন নিশ্চয়তা আমরা দিতে পারি না। রক্তদাতা সাড়া দিলেও ধরে নেবেন না যে তিনি রাজি। আগে তাঁর সাথে কথা বলে নিশ্চিত হোন।'] },
      { heading: 'অপব্যবহার', body: ['নিয়ম ভাঙলে অ্যাডমিন অ্যাকাউন্ট বা প্রোফাইল স্থগিত করতে পারেন। কোনো সংগঠনের অনুমোদনও স্থগিত হতে পারে।'] },
    ] as Section[],
  },
  en: {
    title: 'Legal information',
    updated: (date: string) => `Last updated: ${date}`,
    contactTitle: 'Contact',
    tocLabel: 'On this page',
    contactDirectTitle: 'Reach us directly',
    contactWaysTitle: 'Other ways to get help',
    contactIntro: 'Get in touch with questions, complaints or corrections.',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    contactNotPublished: 'A direct phone number or email has not been published yet. Until then, please use the options below.',
    contactWays: [
      'If you see wrong information or misuse on a profile, organisation or request, use "Report wrong information or misuse" on that page — it goes straight to the administrators.',
      'Contact a coordinator of an approved organisation in your area from the organisation’s page.',
      'To see, change or delete your own information, sign in and use "My account".',
    ],
    contactEmergency: 'This page is not for medical emergencies — contact a hospital or blood bank.',
    privacyTitle: 'Privacy policy',
    privacyIntro: 'What we keep, why, who can see it, and what you can do — in plain words.',
    privacySections: [
      {
        heading: 'What we keep',
        body: [
          'Account: name, mobile number, email (optional) and a secure hash of your password.',
          'Donor profile: full name, date of birth, blood group, division/district/upazila, area name, contact number and preference, donation history, and whether you can donate.',
          'Blood requests: requester name and number, hospital name, blood group, quantity, time and a short note. We do not ask for diagnoses or identity documents.',
        ],
      },
      { heading: 'What we do not keep', body: ['We do not track your live location (GPS) and do not ask for your full home address. We do not store IP addresses directly — only a protected hash used to prevent abuse.'] },
      {
        heading: 'Who sees what',
        body: [
          'Donors choose who can see each piece of information: everyone, signed-in users, approved community coordinators only, or only themselves.',
          'A new donor appears in donor search as soon as they register, if they agreed to be listed. Administrators or moderators can close a listing when needed.',
          'Nobody can ever see a phone number without signing in. Every number view is recorded.',
          'Dates of birth are never published. Coordinators only see age.',
          'Platform administrators can see account details for safety and abuse prevention; every such view is recorded.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'See and correct your information from "My account".',
          'Stay out of search at any time by turning off "Show me in donor search" or pausing your profile.',
          'Deactivate your account or request deletion from the "Security" page. When an administrator completes a deletion request, your donor profile, donation history, memberships and notifications are deleted, and your name and number are removed from your blood requests.',
        ],
      },
      { heading: 'How long we keep it', body: ['Information is kept for as long as you keep your account. Old sign-in sessions and abuse-prevention counters are removed regularly. Security logs never contain phone numbers or passwords.'] },
      { heading: 'Security', body: ['Passwords are stored with a strong hash (scrypt). The sign-in cookie can only be read by the server. Every important action is permission-checked on the server and recorded.'] },
    ] as Section[],
    termsTitle: 'Terms of use',
    termsIntro: 'By using this website you agree to the following.',
    termsSections: [
      {
        heading: 'What this website is',
        body: [
          'Holy Mission Blood Donation is a community initiative. This platform connects voluntary blood donors, people who need blood, and blood donation organisations. It is not a hospital, blood bank or medical service.',
          'This platform is for Lakshmipur district only: donor registration, donor search, blood requests and organisations all use addresses in Lakshmipur.',
          'Independent organisations registered here are not Holy Mission branches.',
        ],
      },
      { heading: 'Medical caution', body: ['The "can donate" status and the "estimated next donation date" shown here are not proof of medical eligibility. Blood must always be tested at a hospital or licensed blood bank before it is given.'] },
      { heading: 'Your responsibilities', body: ['Give true information. Do not create accounts in someone else’s name.', 'Use donors’ numbers only for blood needs — not for advertising, harassment or collecting data.', 'Asking for or paying money for blood is not allowed.'] },
      { heading: 'What we cannot promise', body: ['We cannot guarantee that a donor will be found or will donate. Even if a donor responds, do not assume they have agreed — talk to them first.'] },
      { heading: 'Misuse', body: ['Administrators may suspend accounts or profiles that break these rules. An organisation’s approval may also be suspended.'] },
    ] as Section[],
  },
});
