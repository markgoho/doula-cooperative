export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "members",
        "forms-api",
        "members-api",
        "profiles-api",
        "admin-members-api",
        "admin-messages-api",
        "admin-match-requests-api",
        "admin-unclaimed-profiles-api",
        "stripe-webhook-api",
        "profile-webhook-api",
        "shared-api",
        "hugo",
        "deps",
      ],
    ],
  },
};
