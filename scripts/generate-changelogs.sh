#!/bin/bash
# Generate per-folder changelogs from conventional commits

COMPONENTS=(
  "members"
  "functions/src/forms-api"
  "functions/src/members-api"
  "functions/src/profiles-api"
  "functions/src/admin-members-api"
  "functions/src/admin-messages-api"
  "functions/src/admin-match-requests-api"
  "functions/src/admin-unclaimed-profiles-api"
  "functions/src/stripe-webhook-api"
  "functions/src/profile-webhook-api"
)

for component in "${COMPONENTS[@]}"; do
  echo "Generating changelog for $component..."
  bunx conventional-changelog -p conventionalcommits \
    -i "$component/CHANGELOG.md" -s \
    --commit-path "$component/" \
    -r 0
done

echo "Done. All changelogs generated."
