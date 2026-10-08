# Publishing

Push to `main` to build the extension and upload a VSIX artifact to GitHub Actions. If the version in `package.json` already exists on Marketplace, the workflow skips publishing. To release, update `CHANGELOG.md`, run `npm version patch --no-git-tag-version` (or choose `minor` or `major`), commit the changes, and push. Marketplace still performs its normal validation after upload.

The workflow uses GitHub OpenID Connect and Microsoft Entra ID with `vsce publish --azure-credential`. There is no personal access token, client secret, or expiring credential to renew. Microsoft retires global Azure DevOps PATs on December 1, 2026; this workflow does not depend on them.

## One-time Microsoft setup

You need an Entra workforce directory that you can manage. A personal Microsoft account signed into Marketplace is not enough. Use an existing organization directory if available. Otherwise, Microsoft's tenant setup guide requires an Azure account with an active subscription. Account signup can require a card and agreement to billing terms; complete that yourself. The publishing workflow does not deploy Azure compute, storage, or other billable infrastructure, and uses Entra ID Free. Do not create an external/customer tenant for this setup.

1. Open [Microsoft Entra admin center](https://entra.microsoft.com), select your directory, and go to **Entra ID → App registrations → New registration**.
2. Set the name to `fast-swift-format-publisher`, choose **Accounts in this organizational directory only**, leave the redirect URI empty, and click **Register**.
3. On the app's **Overview**, copy **Application (client) ID** and **Directory (tenant) ID**.
4. Go to **Certificates & secrets → Federated credentials → Add credential**. Choose **GitHub Actions deploying Azure resources** as the scenario. Enter organization `mesqueeb`, organization ID `3253920`, repository `fast-swift-format`, repository ID `1411011937`, entity type **Branch**, branch `main`, and name `github-main`. Keep audience `api://AzureADTokenExchange`. This repository uses GitHub's immutable subject format, so the subject must be `repo:mesqueeb@3253920/fast-swift-format@1411011937:ref:refs/heads/main`. Click **Add**. Do not create a client secret or grant Azure subscription roles.
5. In [GitHub Actions secrets](https://github.com/mesqueeb/fast-swift-format/settings/secrets/actions), click **New repository secret** and add `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` using the two IDs from step 3.
6. In [GitHub Actions](https://github.com/mesqueeb/fast-swift-format/actions/workflows/publish.yml), choose **Publish extension → Run workflow → main → Run workflow**. This verifies authentication even when the current version is already published. If authentication succeeds but publisher verification fails, the run summary shows the **Marketplace identity ID**.
7. Open [the publisher management page](https://marketplace.visualstudio.com/manage/publishers/mesqueeb), choose **Members → Add**, enter the Marketplace identity ID from the run summary, and assign **Contributor**. Use the Azure DevOps profile ID printed by the workflow, not the app registration Object ID. This grants that identity permission to publish under `mesqueeb`; review the grant before saving.
8. Rerun the workflow. The publishing permission verification should succeed, and the existing version should be skipped. Future version bumps pushed to `main` publish automatically.

The federated trust accepts only this repository's `main` branch. Publishing is serialized, and a running upload is not canceled by a subsequent push. Marketplace query or authentication errors fail the run rather than being treated as an unpublished version.

## References

- [VS Code publishing and Entra authentication](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)
- [Azure Login with GitHub OpenID Connect](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended)
- [Microsoft Entra tenant prerequisites](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant)
- [Azure account and billing options](https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account)
