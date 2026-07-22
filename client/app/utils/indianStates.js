// Canonical list of Indian states + union territories, for the address forms.
//
// Free-text state fields produce the same place spelled a dozen ways ("MH",
// "Maharashtra", "maharastra"), which then can't be grouped or filtered. A fixed
// list keeps the value canonical and matches the app's other dropdowns (Gender,
// Qualification) so the forms read as one system.
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// { label, value } options for PremiumSelect. A previously-stored value that
// isn't in the list (legacy "MH", a typo) is appended so editing an old record
// still shows its current state instead of silently blanking it.
export const stateOptions = (current) => {
  const opts = INDIAN_STATES.map((s) => ({ label: s, value: s }));
  if (current && !INDIAN_STATES.includes(current)) {
    opts.unshift({ label: current, value: current });
  }
  return opts;
};
