# QA Script: New Membership Sign-Up

**Test Date**: _____________
**Tester**: Nella
**Email to Use**: doulanella@gmail.com

---

## Pre-Test Checklist

- [ ] Ensure you have access to **doulanella@gmail.com** inbox
- [ ] Have test payment card ready: `4242 4242 4242 4242`
- [ ] Use any future expiration date (e.g., 12/27)
- [ ] Use any 3-digit CVV (e.g., 123)
- [ ] Use any ZIP code (e.g., 14607)

---

## Part 1: Join the Cooperative (Stripe Checkout)

### Step 1: Navigate to Sign-Up Page
1. Open browser (Chrome or Firefox preferred)
2. Go to: `https://doulacooperative.com/join-the-doula-cooperative/?key=show-pricing-table`
   - **Important**: Make sure to include the `?key=show-pricing-table` part - this unlocks the pricing table

**✅ Success Criteria:**
- Page loads with title "Join the Doula Cooperative"
- You see pricing information for membership ($50/month)
- There's a Stripe pricing table with a "Join" or "Subscribe" button

**🚨 Report if:**
- Page shows "New memberships have been paused" message (means the key didn't work)
- No pricing table appears
- Page doesn't load or shows errors
- You forgot to include `?key=show-pricing-table` in the URL (go back and add it)

---

### Step 2: Start Checkout Process
1. Click the **"Join the Cooperative"** or **"Subscribe"** button in the pricing table

**✅ Success Criteria:**
- Stripe checkout modal/page opens
- Shows "$50/month" membership plan
- Has fields for email and payment details

**🚨 Report if:**
- Nothing happens when clicking button
- Error message appears
- Wrong price is shown

---

### Step 3: Enter Email
1. In the **Email** field, enter: `doulanella@gmail.com`
2. Continue to payment details

**✅ Success Criteria:**
- Email is accepted
- Form advances to payment section

**🚨 Report if:**
- Email is rejected
- Form doesn't advance

---

### Step 4: Enter Payment Details
Enter the following **TEST** card information:
- **Card Number**: `4242 4242 4242 4242`
- **Expiration**: `12/27` (or any future date)
- **CVV**: `123`
- **Name on Card**: Nella [Your Last Name]
- **Billing ZIP**: `14607`

**✅ Success Criteria:**
- All fields accept the information
- No validation errors appear

**🚨 Report if:**
- Card is rejected before submitting
- Required fields are missing
- Form shows errors

---

### Step 5: Complete Purchase
1. Click **"Subscribe"** or **"Join"** button to complete payment
2. Wait for processing (may take 5-10 seconds)

**✅ Success Criteria:**
- Processing completes successfully
- You're redirected to a "Thank You" page
- Thank you page mentions:
  - Checking email for welcome message
  - Password setup instructions
  - Contact info if no email received

**🚨 Report if:**
- Payment is declined
- You see an error message
- Page hangs or doesn't redirect
- You're not redirected to a thank you page

**📸 Screenshot**: Take a screenshot of the thank you page

---

## Part 2: Welcome Email & Password Setup

### Step 6: Check Welcome Email
1. Open **doulanella@gmail.com** inbox
2. Look for email from Rochester Doula Cooperative
3. Note the time it arrives (should be within 2-3 minutes)

**✅ Success Criteria:**
- Email arrives from the doula cooperative
- Subject line mentions welcome or membership
- Email contains:
  - Welcome message
  - Password reset/setup link
  - Membership benefits listed
  - Contact information (mark@doulacooperative.com)

**🚨 Report if:**
- No email after 5 minutes
- Email goes to spam folder
- Email is missing password reset link
- Links in email are broken

**📸 Screenshot**: Take a screenshot of the email (redact sensitive info if sharing)

---

### Step 7: Set Up Password
1. In the welcome email, click the **password reset/setup link**
2. You should be taken to members.doulacooperative.com

**✅ Success Criteria:**
- Link opens password setup page on members.doulacooperative.com
- Page shows password creation form

**🚨 Report if:**
- Link is expired or invalid
- Link goes to wrong website
- Password setup page doesn't load

---

### Step 8: Create Password
1. Enter a new password (use something you'll remember for next steps)
2. Confirm the password
3. Click **"Reset Password"** or **"Set Password"** button

**Password Requirements** (if shown):
- Note what requirements are displayed

**✅ Success Criteria:**
- Password is accepted
- You're logged in automatically OR redirected to sign-in page
- You see the members area dashboard

**🚨 Report if:**
- Password is rejected without clear reason
- Form shows errors
- Nothing happens after clicking button

---

## Part 3: Members Area Access

### Step 9: View Membership Dashboard
You should now be on the `/membership` page showing your account details.

**✅ Success Criteria:**
Check that the following information is displayed:
- [ ] Your email address (doulanella@gmail.com)
- [ ] Account creation date (today's date)
- [ ] Subscription start date (today's date)
- [ ] Next payment date (approximately 1 month from today)
- [ ] Membership expiration date (last day of current month)
- [ ] Newsletter subscription toggle (may be checked or unchecked)

**✅ Additional Features to Check:**
- [ ] There's a section about "Doula Profile"
- [ ] Options to either "Claim Existing Profile" or "Create New Profile"

**🚨 Report if:**
- Any dates are missing or incorrect
- Email is wrong
- Page shows errors or missing sections
- Page is blank or doesn't load

**📸 Screenshot**: Take a screenshot of the membership dashboard

---

### Step 10: Test Sign Out and Sign Back In
1. Find and click **"Sign Out"** or **"Log Out"** button (likely in header or menu)
2. Confirm you're signed out (should return to sign-in page)
3. Click **"Sign In"** (if not already on sign-in page)
4. Enter:
   - Email: `doulanella@gmail.com`
   - Password: [the password you created in Step 8]
5. Click **"Sign In"**

**✅ Success Criteria:**
- Sign out works correctly
- Sign in page loads
- Sign in with email/password works
- You're returned to the membership dashboard
- All your information is still there

**🚨 Report if:**
- Can't find sign out button
- Sign out doesn't work
- Can't sign back in with credentials
- Error messages appear
- Dashboard shows different data after re-login

---

## Part 4: Newsletter Subscription (Optional)

### Step 11: Test Newsletter Toggle
On the membership dashboard, find the newsletter subscription section.

1. Note current status (subscribed or not)
2. Click the toggle to change subscription status
3. Wait for confirmation message
4. Refresh the page
5. Verify status persisted

**✅ Success Criteria:**
- Toggle switches state
- Success message appears
- After refresh, status remains changed
- No errors occur

**🚨 Report if:**
- Toggle doesn't work
- Error messages appear
- Status doesn't persist after refresh

---

## Summary Checklist

After completing all steps, verify:

- [ ] Successfully completed Stripe checkout with test card
- [ ] Received welcome email within 5 minutes
- [ ] Set up password using link in email
- [ ] Accessed members dashboard showing correct information
- [ ] Successfully signed out and back in
- [ ] Newsletter toggle works (optional)

---

## Issues to Report

**For each issue, please note:**
1. Step number where it occurred
2. What you expected to happen
3. What actually happened
4. Screenshot if possible
5. Any error messages (exact text)
6. Browser and device used

**Send report to**: [Your contact info]

---

## Notes Section

Use this space for any additional observations:

- Overall experience (easy, confusing, smooth, buggy):
- Time to complete entire flow: ________ minutes
- Most confusing step:
- Suggestions for improvement:

---

## Test Card Information Reference

**✅ Test Cards That Should Work:**
- Success: `4242 4242 4242 4242`

**❌ Test Cards That Should Fail (do NOT use these):**
- These are for testing error handling: `4000 0000 0000 0002`

---

**End of QA Script**
