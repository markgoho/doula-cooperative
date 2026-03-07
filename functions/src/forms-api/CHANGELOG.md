## (2026-03-07)

### Features

- add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
- add reCAPTCHA score validation for contact and match forms ([9b4e439](https://github.com/markgoho/doula-cooperative/commit/9b4e439ea8a8665fc8bab07e15bc458e51139387))
- enhance E2E tests with user-facing selectors and improved API mocking ([40acae1](https://github.com/markgoho/doula-cooperative/commit/40acae160075d92813e45cc9ce44dbbd8d9875ce))
- **forms-api:** implement contact and doula match form notifications with email service integration ([5a0bb0e](https://github.com/markgoho/doula-cooperative/commit/5a0bb0e4939e993fe96f6c5af2426e5055e1c991))
- Implement Stripe webhook service with idempotency checks and response schemas ([a8825b4](https://github.com/markgoho/doula-cooperative/commit/a8825b41bdb1704937970c46391a00e1f2c756e3))
- migrate adminSendInvitation to REST API and consolidate email service ([#46](https://github.com/markgoho/doula-cooperative/issues/46)) ([85d6c11](https://github.com/markgoho/doula-cooperative/commit/85d6c117f05714c4a7313d39444baf0991bc0e33)), closes [#38](https://github.com/markgoho/doula-cooperative/issues/38)

### Bug Fixes

- add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
- remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
