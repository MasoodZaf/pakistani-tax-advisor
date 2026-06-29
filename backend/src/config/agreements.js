// Single source of truth for the legal agreements a filer must accept before
// entering the main app. The consent gate (Frontend) and the
// /api/agreements endpoints both read from this list.
//
// To require re-acceptance after editing an agreement's wording, BUMP its
// `version`. Existing users will then have a pending agreement again and the
// gate will re-prompt them; their prior acceptance row is preserved as history.
//
// `key`     — stable identifier stored in user_agreement_acceptances.
// `version` — current published version (bump to force re-consent).
// `title`   — human label shown in the consent screen.
// `route`   — public page where the full text lives (opened to read before agreeing).

const REQUIRED_AGREEMENTS = [
  { key: 'terms',                version: '1.0', title: 'Terms & Conditions',       route: '/terms' },
  { key: 'privacy',              version: '1.0', title: 'Privacy Policy',           route: '/privacy' },
  { key: 'user_agreement',       version: '1.0', title: 'User Agreement',           route: '/user-agreement' },
  { key: 'consultant_agreement', version: '1.0', title: 'Tax Consultant Agreement', route: '/consultant-agreement' },
];

module.exports = { REQUIRED_AGREEMENTS };
