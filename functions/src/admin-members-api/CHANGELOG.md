##  (2026-04-20)

### Features

* add 30-day refund window and member refund notification email ([7b454a0](https://github.com/markgoho/doula-cooperative/commit/7b454a0dd66041ec1e06a1a4c483b07b992ed21e))
* add admin draft profile deletion flow ([9d9f18a](https://github.com/markgoho/doula-cooperative/commit/9d9f18a19c2ee3b6dfcb20709578da6809bb312f))
* add admin member management features and improve API integration ([a3a3c53](https://github.com/markgoho/doula-cooperative/commit/a3a3c53c6f3aac56756384eaab80763f691b65b0))
* add admin member profile editing flow ([fc88b51](https://github.com/markgoho/doula-cooperative/commit/fc88b5121eb774c4fe02f241df2a23c472ff0020))
* add admin protection and improve error handling based on PR review ([#44](https://github.com/markgoho/doula-cooperative/issues/44)) ([5d961e4](https://github.com/markgoho/doula-cooperative/commit/5d961e419d37b92e1638e8c9e916d75c2de3262f))
* add admin read profile endpoint to bypass draft access control ([805eff7](https://github.com/markgoho/doula-cooperative/commit/805eff73d29e9b6bba1a884bff4a30e0349e5f58))
* Add Elysia API testing guidelines and shared auth mocks for consistent authentication testing ([1c286dd](https://github.com/markgoho/doula-cooperative/commit/1c286dd353c02077f38293a3b1274b54d0bccadc))
* add prefix option to Elysia apps for Firebase Hosting compatibility ([d1c25c1](https://github.com/markgoho/doula-cooperative/commit/d1c25c10b28889b39247a5dab7b0adcbaf9533f8))
* add versioning and changelog infrastructure ([bb61cff](https://github.com/markgoho/doula-cooperative/commit/bb61cff47f85e7f7a5a0cdb8877345183ddd611f))
* **admin-members:** add profile approval flow ([524a91e](https://github.com/markgoho/doula-cooperative/commit/524a91eb0cb52c3532d8931e736071708a56cb5c))
* **admin:** add ability to link unlinked profiles to members ([#78](https://github.com/markgoho/doula-cooperative/issues/78)) ([255d2ce](https://github.com/markgoho/doula-cooperative/commit/255d2cee0aa7f5bb7e495109fe28972cf1f679ab))
* clean slate delete with GitHub profile deletion and ImageKit cleanup ([#63](https://github.com/markgoho/doula-cooperative/issues/63)) ([bc84389](https://github.com/markgoho/doula-cooperative/commit/bc84389d9adc6a2bcd439b21142f2d5d46d67fbc))
* handle Stripe refunds via webhook and admin UI ([#62](https://github.com/markgoho/doula-cooperative/issues/62)) ([014a036](https://github.com/markgoho/doula-cooperative/commit/014a0361bef0241de65e186fa7f3484d01788aed))
* Implement admin membership management service ([4753ff5](https://github.com/markgoho/doula-cooperative/commit/4753ff507004b9674e91fe4739a01e82209b8f7f))
* implement MemberFirestoreService for Firestore operations on members ([0c194b8](https://github.com/markgoho/doula-cooperative/commit/0c194b80287e5c64c5122665626380fb08c41cea))
* migrate admin claim functions to Elysia API with generic claims endpoint ([#33](https://github.com/markgoho/doula-cooperative/issues/33)) ([8670eea](https://github.com/markgoho/doula-cooperative/commit/8670eeafb5d66baf861ceced2348fbccb311869d)), closes [#25](https://github.com/markgoho/doula-cooperative/issues/25)
* migrate admin match requests functions to Elysia API ([#28](https://github.com/markgoho/doula-cooperative/issues/28)) ([5ef51a3](https://github.com/markgoho/doula-cooperative/commit/5ef51a3f2bcacdc165244d2b125765f26c8236be)), closes [#22](https://github.com/markgoho/doula-cooperative/issues/22) [#22](https://github.com/markgoho/doula-cooperative/issues/22)
* notify admin about new member signups ([7ba1d3d](https://github.com/markgoho/doula-cooperative/commit/7ba1d3d5543de45d39cc96a9de28d86fb607d3e3))

### Bug Fixes

* add profile image URL to admin member detail page ([03bea4d](https://github.com/markgoho/doula-cooperative/commit/03bea4dc990738cbbf5c06a5a7d1d6c15ce82d84))
* add typed handleRequest wrapper to resolve 898 lint errors in test files ([e9015f4](https://github.com/markgoho/doula-cooperative/commit/e9015f43e8a885496f4a658465d50ed3756c08d4))
* **admin-members-api:** clean up import records after profile link ([8747166](https://github.com/markgoho/doula-cooperative/commit/87471668575014de5f131a8a87ecddaf1a53d288))
* **admin-members-api:** resolve lint errors in draft profile deletion ([50c841c](https://github.com/markgoho/doula-cooperative/commit/50c841cca3175534913b05ee7000791cbf236271))
* include memberNotified in refund API response schema and mapping ([43ea4b2](https://github.com/markgoho/doula-cooperative/commit/43ea4b2ababb315478e4c49573649001c430e418))
* **profile-webhook-api:** bcc webmaster on profile update emails ([9774f4a](https://github.com/markgoho/doula-cooperative/commit/9774f4a557aa281fa7ff45ee5f77084b0be5f4c9))
* remove profile approval blockers for new members ([839e77c](https://github.com/markgoho/doula-cooperative/commit/839e77ce7419c07839451271e0de7c9de77428eb))
* remove unnecessary type assertions in test files ([f774f3b](https://github.com/markgoho/doula-cooperative/commit/f774f3b3cab00ca2afc3e24d0f6ff50e52cd6ff6))
