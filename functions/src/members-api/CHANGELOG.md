##  (2026-04-20)

### Features

* add admin protection and improve error handling based on PR review ([#44](https://github.com/markgoho/doula-cooperative/issues/44)) ([5d961e4](https://github.com/markgoho/doula-cooperative/commit/5d961e419d37b92e1638e8c9e916d75c2de3262f))
* Add Elysia API testing guidelines and shared auth mocks for consistent authentication testing ([1c286dd](https://github.com/markgoho/doula-cooperative/commit/1c286dd353c02077f38293a3b1274b54d0bccadc))
* add health check tests for profiles API ([164938c](https://github.com/markgoho/doula-cooperative/commit/164938c8af94a682cddcdac92bc66e7a46b6e485))
* add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
* add versioning and changelog infrastructure ([bb61cff](https://github.com/markgoho/doula-cooperative/commit/bb61cff47f85e7f7a5a0cdb8877345183ddd611f))
* clean slate delete with GitHub profile deletion and ImageKit cleanup ([#63](https://github.com/markgoho/doula-cooperative/issues/63)) ([bc84389](https://github.com/markgoho/doula-cooperative/commit/bc84389d9adc6a2bcd439b21142f2d5d46d67fbc))
* handle Stripe refunds via webhook and admin UI ([#62](https://github.com/markgoho/doula-cooperative/issues/62)) ([014a036](https://github.com/markgoho/doula-cooperative/commit/014a0361bef0241de65e186fa7f3484d01788aed))
* Implement admin membership management service ([4753ff5](https://github.com/markgoho/doula-cooperative/commit/4753ff507004b9674e91fe4739a01e82209b8f7f))
* Implement GitHub batch operations utility ([23f3633](https://github.com/markgoho/doula-cooperative/commit/23f36333a76de4e1ef4064f049e01f0a7a7f7f2d))
* implement MemberFirestoreService for Firestore operations on members ([0c194b8](https://github.com/markgoho/doula-cooperative/commit/0c194b80287e5c64c5122665626380fb08c41cea))
* Implement MemberService with Firestore integration ([78be15a](https://github.com/markgoho/doula-cooperative/commit/78be15a0f4e2b396588e02393d9ccfcdb11f8b90))
* implement newsletter preference update endpoint with tests ([391616c](https://github.com/markgoho/doula-cooperative/commit/391616c233854d20b78ae8ebaa784210b443d34d))
* migrate adminSendInvitation to REST API and consolidate email service ([#46](https://github.com/markgoho/doula-cooperative/issues/46)) ([85d6c11](https://github.com/markgoho/doula-cooperative/commit/85d6c117f05714c4a7313d39444baf0991bc0e33)), closes [#38](https://github.com/markgoho/doula-cooperative/issues/38)
* notify admin about new member signups ([7ba1d3d](https://github.com/markgoho/doula-cooperative/commit/7ba1d3d5543de45d39cc96a9de28d86fb607d3e3))

### Bug Fixes

* add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
* make verify-email endpoint idempotent for already-verified emails ([#68](https://github.com/markgoho/doula-cooperative/issues/68)) ([9de2431](https://github.com/markgoho/doula-cooperative/commit/9de2431549cd02ac90a4e69515c9bd41fa33c94e))
* **profile-webhook-api:** bcc webmaster on profile update emails ([9774f4a](https://github.com/markgoho/doula-cooperative/commit/9774f4a557aa281fa7ff45ee5f77084b0be5f4c9))
* remove profile approval blockers for new members ([839e77c](https://github.com/markgoho/doula-cooperative/commit/839e77ce7419c07839451271e0de7c9de77428eb))
* remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
