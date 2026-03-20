##  (2026-03-20)

### Features

* add bulk refresh payment dates for unclaimed profiles ([dbb187c](https://github.com/markgoho/doula-cooperative/commit/dbb187c29ee1e11a2cd67e7ecc75633b22589c23))
* add change-email-and-resend route with unit tests ([f7a00a5](https://github.com/markgoho/doula-cooperative/commit/f7a00a50ce7b29aeb15af29a8581ed05f4e6aa37))
* add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
* add schemas, types, and interfaces for change-email-and-resend endpoint ([490d469](https://github.com/markgoho/doula-cooperative/commit/490d4692eef14aeadf0bfb74de93a0efc182c5a4))
* add update-email backend endpoint for pre-invitation unclaimed profiles ([d63d0f5](https://github.com/markgoho/doula-cooperative/commit/d63d0f5c56d632eef22a556c15adfd991029b19c))
* add versioning and changelog infrastructure ([bb61cff](https://github.com/markgoho/doula-cooperative/commit/bb61cff47f85e7f7a5a0cdb8877345183ddd611f))
* draft Hugo profile when deleting unclaimed profile ([8fb13ba](https://github.com/markgoho/doula-cooperative/commit/8fb13ba279d885a7663974ade3ab7ae8235d00e6))
* implement change-email-and-resend service for unclaimed profiles ([f96c27a](https://github.com/markgoho/doula-cooperative/commit/f96c27a7fbf1d16718dc44d044f2fea643f68e6e))
* implement delete unclaimed profile functionality with tests and UI integration ([45e74fa](https://github.com/markgoho/doula-cooperative/commit/45e74fa9a607d984d09e950f68c84417d031d449))
* migrate admin unclaimed profiles functions to Elysia API ([#30](https://github.com/markgoho/doula-cooperative/issues/30)) ([51cd7f2](https://github.com/markgoho/doula-cooperative/commit/51cd7f221c391e839f5a39c5e0336071c4094a6e)), closes [#24](https://github.com/markgoho/doula-cooperative/issues/24) [#24](https://github.com/markgoho/doula-cooperative/issues/24)
* migrate adminSendInvitation to REST API and consolidate email service ([#46](https://github.com/markgoho/doula-cooperative/issues/46)) ([85d6c11](https://github.com/markgoho/doula-cooperative/commit/85d6c117f05714c4a7313d39444baf0991bc0e33)), closes [#38](https://github.com/markgoho/doula-cooperative/issues/38)
* migrate to invitation-based user creation and fix critical error handling ([#50](https://github.com/markgoho/doula-cooperative/issues/50)) ([6ef45a8](https://github.com/markgoho/doula-cooperative/commit/6ef45a83983a02f7349add07756ed77d8e854ea4))
* notify admin about new member signups ([7ba1d3d](https://github.com/markgoho/doula-cooperative/commit/7ba1d3d5543de45d39cc96a9de28d86fb607d3e3))
* wire change-email-and-resend route into plugin with integration tests ([f8dfd44](https://github.com/markgoho/doula-cooperative/commit/f8dfd44af73bab23926adc6ac49b321ba483d5ba))

### Bug Fixes

* add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
* **profile-webhook-api:** bcc webmaster on profile update emails ([9774f4a](https://github.com/markgoho/doula-cooperative/commit/9774f4a557aa281fa7ff45ee5f77084b0be5f4c9))
* remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
