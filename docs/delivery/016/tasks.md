# Tasks for PBI 016: Social/Meta Card Support for Doula Profile and Other Pages

This document lists all tasks associated with PBI 016.

**Parent PBI**: [PBI 016: Social/Meta Card Support for Doula Profile and Other Pages](./prd.md)

## Task Summary

| Task ID | Name                                                      | Status   | Description                                                                                                                                                                                                                                          |
| :------ | :-------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 016-01  | [Research and PoC for Hugo Image Generation](./016-01.md) | Done | Research and evaluate libraries or Hugo modules for dynamic image generation. Create a proof-of-concept to ensure the chosen solution can generate an image with text and a profile picture at build time.                                           |
| 016-02  | [Implement Doula Profile Card Generation](./016-02.md)    | Done | Implement the image generation logic to create a unique social card for each doula profile, including their photo, name, credentials, and the "Doula Cooperative" brand text.                                                                        |
| 016-03  | [Update Hugo Meta Tag Templates](./016-03.md)             | Done | Update the Hugo `meta.html` partial (or create a new one) to include the correct Open Graph and Twitter Card meta tags that point to the newly generated social card images for doula profiles.                                                      |
| 016-04  | [Implement Generic Fallback Card](./016-04.md)            | Done | Create and configure a generic fallback social card image to be used for all non-doula-profile pages, and update the templates to use it.                                                                                                            |
| 016-05  | [End-to-End Testing and Verification](./016-05.md)        | Done | Manually test the social card functionality by sharing links on various platforms (or using their debugger tools) to verify that the correct cards for doula profiles and fallback pages appear as expected on Facebook, X, LinkedIn, and Instagram. |
