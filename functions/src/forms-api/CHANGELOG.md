##  (2026-04-20)

### Features

* add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
* add reCAPTCHA score validation for contact and match forms ([9b4e439](https://github.com/markgoho/doula-cooperative/commit/9b4e439ea8a8665fc8bab07e15bc458e51139387))
* add versioning and changelog infrastructure ([bb61cff](https://github.com/markgoho/doula-cooperative/commit/bb61cff47f85e7f7a5a0cdb8877345183ddd611f))
* block contact form spam more aggressively ([ffe276e](https://github.com/markgoho/doula-cooperative/commit/ffe276ee68c2c320252352786d3118cc39eb66e6))
* enhance E2E tests with user-facing selectors and improved API mocking ([40acae1](https://github.com/markgoho/doula-cooperative/commit/40acae160075d92813e45cc9ce44dbbd8d9875ce))
* **forms-api:** implement contact and doula match form notifications with email service integration ([5a0bb0e](https://github.com/markgoho/doula-cooperative/commit/5a0bb0e4939e993fe96f6c5af2426e5055e1c991))
* Implement Stripe webhook service with idempotency checks and response schemas ([a8825b4](https://github.com/markgoho/doula-cooperative/commit/a8825b41bdb1704937970c46391a00e1f2c756e3))
* **members:** add self-service email change flow ([1d4f851](https://github.com/markgoho/doula-cooperative/commit/1d4f85116258ad8567db656157bdb56d3d9bff9f))
* migrate adminSendInvitation to REST API and consolidate email service ([#46](https://github.com/markgoho/doula-cooperative/issues/46)) ([85d6c11](https://github.com/markgoho/doula-cooperative/commit/85d6c117f05714c4a7313d39444baf0991bc0e33)), closes [#38](https://github.com/markgoho/doula-cooperative/issues/38)
* notify admin about new member signups ([7ba1d3d](https://github.com/markgoho/doula-cooperative/commit/7ba1d3d5543de45d39cc96a9de28d86fb607d3e3))

### Bug Fixes

* add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
* **change-email:** address PR review findings ([80e0799](https://github.com/markgoho/doula-cooperative/commit/80e07995957a7af8ab619ab4e1347ea146654dc0))
* **members-api:** harden email sync error handling and testing ([db11a12](https://github.com/markgoho/doula-cooperative/commit/db11a12acbfc8c080040ccac969b7ef195bfe564))
* **profile-webhook-api:** bcc webmaster on profile update emails ([9774f4a](https://github.com/markgoho/doula-cooperative/commit/9774f4a557aa281fa7ff45ee5f77084b0be5f4c9))
* remove profile approval blockers for new members ([839e77c](https://github.com/markgoho/doula-cooperative/commit/839e77ce7419c07839451271e0de7c9de77428eb))
* remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
