##  (2026-04-20)

### Features

* add 30-day refund window and member refund notification email ([7b454a0](https://github.com/markgoho/doula-cooperative/commit/7b454a0dd66041ec1e06a1a4c483b07b992ed21e))
* add Facebook group integration to onboarding flow ([5847460](https://github.com/markgoho/doula-cooperative/commit/58474603ffca490f2139faba9b0c81dc53b84417))
* add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
* add versioning and changelog infrastructure ([bb61cff](https://github.com/markgoho/doula-cooperative/commit/bb61cff47f85e7f7a5a0cdb8877345183ddd611f))
* clean slate delete with GitHub profile deletion and ImageKit cleanup ([#63](https://github.com/markgoho/doula-cooperative/issues/63)) ([bc84389](https://github.com/markgoho/doula-cooperative/commit/bc84389d9adc6a2bcd439b21142f2d5d46d67fbc))
* handle Stripe refunds via webhook and admin UI ([#62](https://github.com/markgoho/doula-cooperative/issues/62)) ([014a036](https://github.com/markgoho/doula-cooperative/commit/014a0361bef0241de65e186fa7f3484d01788aed))
* Implement GitHub batch operations utility ([23f3633](https://github.com/markgoho/doula-cooperative/commit/23f36333a76de4e1ef4064f049e01f0a7a7f7f2d))
* Implement Stripe webhook service with idempotency checks and response schemas ([a8825b4](https://github.com/markgoho/doula-cooperative/commit/a8825b41bdb1704937970c46391a00e1f2c756e3))
* migrate adminSendInvitation to REST API and consolidate email service ([#46](https://github.com/markgoho/doula-cooperative/issues/46)) ([85d6c11](https://github.com/markgoho/doula-cooperative/commit/85d6c117f05714c4a7313d39444baf0991bc0e33)), closes [#38](https://github.com/markgoho/doula-cooperative/issues/38)
* migrate to invitation-based user creation and fix critical error handling ([#50](https://github.com/markgoho/doula-cooperative/issues/50)) ([6ef45a8](https://github.com/markgoho/doula-cooperative/commit/6ef45a83983a02f7349add07756ed77d8e854ea4))
* notify admin about new member signups ([7ba1d3d](https://github.com/markgoho/doula-cooperative/commit/7ba1d3d5543de45d39cc96a9de28d86fb607d3e3))
* prefer checkout custom field name over cardholder name ([248e5c6](https://github.com/markgoho/doula-cooperative/commit/248e5c6c6912b68ea348ac492d4e845286a90612))

### Bug Fixes

* add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
* **profile-webhook-api:** bcc webmaster on profile update emails ([9774f4a](https://github.com/markgoho/doula-cooperative/commit/9774f4a557aa281fa7ff45ee5f77084b0be5f4c9))
* remove profile approval blockers for new members ([839e77c](https://github.com/markgoho/doula-cooperative/commit/839e77ce7419c07839451271e0de7c9de77428eb))
* remove unnecessary optional chain on custom_fields ([51a0c2f](https://github.com/markgoho/doula-cooperative/commit/51a0c2fb8f2c1e1857e456984b90d5010730e289))
* remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
* resolve 'Body already used' error in Stripe webhook handler ([4444f93](https://github.com/markgoho/doula-cooperative/commit/4444f939b9f4b59f25bea258f801c3650f089951))
* update Firestore newsletter status and expiration date on refund ([2916986](https://github.com/markgoho/doula-cooperative/commit/29169863abaf618d455ee1d8236018c68eaf6b1d))
* use conditional spread for optional memberName (exactOptionalPropertyTypes) ([ab2ee3f](https://github.com/markgoho/doula-cooperative/commit/ab2ee3f560a088574b995682351054c824d1a942))
