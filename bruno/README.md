# HotelFeedback API Collection

This Bruno collection documents all 14 Express API routes in `server/server.js`. Select the `Local` environment and run the API at `http://localhost:5000`.

## Authentication

Register or log in with the sample local credentials. Successful register/login requests save the returned bearer token into the Local environment. Google login requires a valid Google ID token and `GOOGLE_CLIENT_ID` configured on the server. Logout revokes the saved session token.

All feedback and action-ticket endpoints, including attachment download, require the bearer token. Requests that use `feedbackId` or `actionTicketId` need IDs from existing records; replace the example IDs in the Local environment.

## Feedback Attachments

`Create Feedback With Attachment` sends an optional `attachment` object with the original `fileName` and a `data` value in `data:<mime-type>;base64,<contents>` format. The API accepts PNG, JPEG, and PDF files up to 5 MB and verifies the content signature. Replace the tiny sample image data with a base64-encoded file to test another attachment.

The collection includes register, username/password login, Google login, logout, feedback create/list/get/update/delete, attachment download, and action-ticket create/list/update/delete requests.