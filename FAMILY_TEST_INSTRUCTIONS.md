# Test the New Member Sign-Up Flow

**Date:** February 2026
**What you're testing:** The full experience of joining the doula cooperative — from paying for membership, to setting your password, to creating a public doula profile page.

**Time needed:** 15–20 minutes

---

## Before You Start

**You'll need:**

- A laptop or phone with a web browser (Chrome, Safari, or Firefox all work)
- **Your own personal email address** — each person must use a different email
- Access to that email inbox (you'll need to click a link in a welcome email)

**Important:** This is using a **test payment system**. No real money will be charged. You'll use a fake credit card number.

---

## PART 1: Pay for Membership

### Step 1 — Open the Sign-Up Page

Open this exact link in your browser. **Copy the entire thing, including everything after the `?`**

```
https://doulacooperative.com/join-the-doula-cooperative/?key=show-pricing-table
```

> **📱 On your phone?** The easiest way is to have Mark text or email you this link so you can tap it.

**You should see:**

- ✅ Page title: "Join the Doula Cooperative"
- ✅ A pricing section showing the membership cost
- ✅ A button to join/subscribe

**Something wrong?**

- ❌ If you see "New memberships have been paused" — the link is incomplete. Make sure the URL ends with `?key=show-pricing-table`
- ❌ If the page won't load — check your internet connection and try again

---

### Step 2 — Click to Join

Click the **"Subscribe"** or **"Join the Cooperative"** button in the pricing table.

A Stripe checkout form should appear with fields for your email and payment info.

---

### Step 3 — Enter Your Email

Type **your personal email address** into the email field.

> ⚠️ **Use your real email** — you'll receive a welcome email at this address that you'll need to continue.

---

### Step 4 — Enter the Fake Credit Card

Use this **test credit card** (no real money will be charged):

| Field               | What to Enter                |
| ------------------- | ---------------------------- |
| **Card Number**     | `4242 4242 4242 4242`        |
| **Expiration Date** | `12/27` (or any future date) |
| **CVC**             | `123` (or any 3 digits)      |
| **Name on Card**    | Your real name               |
| **ZIP Code**        | `14607` (or any valid ZIP)   |

---

### Step 5 — Complete the Payment

Click the **"Subscribe"** or **"Pay"** button. Wait a few seconds for it to process.

**You should see:**

- ✅ A "Thank You" / confirmation page
- ✅ A message about checking your email for next steps

**Something wrong?**

- ❌ Payment declined → Make sure the card number is exactly `4242 4242 4242 4242`
- ❌ Page hangs or spins forever → Wait 30 seconds, then refresh. If still stuck, screenshot and tell Mark.

> 📸 **Take a screenshot** of the thank-you page.

---

## PART 2: Set Up Your Password

### Step 6 — Check Your Email

Open your email inbox and look for an email from **Rochester Doula Cooperative**.

- It should arrive within **2–3 minutes**
- Check your **spam/junk folder** if you don't see it
- The subject line should mention "Welcome" or "membership"

**The email should contain:**

- ✅ A welcome message
- ✅ A link to set your password (this is the most important part)

**Something wrong?**

- ❌ No email after 5 minutes → Check spam. If still nothing, tell Mark.
- ❌ Email arrived but has no link → Screenshot the email and tell Mark.

---

### Step 7 — Click the Password Link

In the welcome email, click the **password setup link**. This will open a new page on `members.doulacooperative.com`.

**You should see:**

- ✅ A "Reset your password" page
- ✅ Your email address shown on the page
- ✅ A field to type a new password and a field to confirm it

---

### Step 8 — Create Your Password

1. Type a password you'll remember (at least 6 characters)
2. Type the same password again in the "Confirm" field
3. Click **"Set new password"**

**You should see:**

- ✅ A success message
- ✅ A **"Continue to sign in"** link

**Click that link** to go to the sign-in page.

---

## PART 3: Sign In and View Your Membership

### Step 9 — Sign In

On the sign-in page at `members.doulacooperative.com`:

1. Enter the **email address** you used during checkout
2. Enter the **password** you just created
3. Click **"Sign In"**

**You should see:**

- ✅ A "Membership" dashboard page
- ✅ "Welcome back, [Your Name]!"
- ✅ Your account details:
  - Your email address
  - Account creation date (today)
  - Subscription date (today)
- ✅ A banner that says **"Create Your Doula Profile"** with a button

**Something wrong?**

- ❌ "Invalid email or password" → Double-check both and try again. Use "Forgot your password?" link if needed.
- ❌ Page shows "Loading membership information..." and never finishes → Wait 10 seconds, then refresh.

> 📸 **Take a screenshot** of the membership dashboard.

---

## PART 4: Create Your Doula Profile

### Step 10 — Start Profile Creation

On the membership dashboard, you should see a **"Create Your Doula Profile"** banner.

Click the **"Create Profile"** button.

**You should see:**

- ✅ A "Create Your Doula Profile" form page
- ✅ Your name pre-filled in the Name field

---

### Step 11 — Fill Out the Profile Form

Fill in the form with **made-up doula information** (this is just for testing!). Here's example data you can use:

**Required fields (marked with \*):**

| Field                        | Example Data                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name** \*                  | (should already have your name)                                                                                                                                                                                                                          |
| **Professional Category** \* | Check any boxes — try "Birth Doula" and "Postpartum Doula"                                                                                                                                                                                               |
| **Bio** \*                   | "I am a passionate doula who loves supporting families through their birth journey. I specialize in providing comfort measures and emotional support during labor and delivery. I have been working with families in the Rochester area for many years." |

**Optional fields (fill in whatever you want):**

| Field             | Example Data             |
| ----------------- | ------------------------ |
| **Pronouns**      | she/her                  |
| **Credentials**   | CD(DONA), CLC            |
| **Business Name** | Rochester Doula Services |
| **Phone**         | 585-555-0123             |
| **Email**         | (your email)             |
| **Website**       | testdoula.com            |

> The **Bio** field needs to have some real-looking text in it. The example above works fine — feel free to copy-paste it.

---

### Step 12 — Submit the Profile

1. Make sure **Name**, at least one **Professional Category** checkbox, and **Bio** are filled in
2. Click the **"Create Profile"** button at the bottom

**You should see:**

- ✅ "Profile created successfully!" message
- ✅ After a moment, you'll be redirected to a profile editing page

**Something wrong?**

- ❌ "Please fill in all required fields" → Check that Name, Bio, and at least one Professional Category checkbox are filled/checked
- ❌ Error message → Screenshot it and tell Mark
- ❌ Button is grayed out → A required field is empty or invalid

> 📸 **Take a screenshot** of the success message.

---

## PART 5: Verify & Sign Out

### Step 13 — Sign Out and Sign Back In

1. Find and click **"Sign Out"** (on the membership page)
2. You should return to the sign-in page
3. Sign in again with your email and password
4. Confirm you see your membership dashboard with all your info still there

**You should see:**

- ✅ All your account details are still there after signing back in
- ✅ The "Create Profile" banner is **gone** (since you already created one)

---

## You're Done! 🎉

**Please send Mark:**

1. **Screenshots** from the steps marked with 📸
2. **Any issues** you ran into — for each issue, note:
   - Which step number
   - What happened vs. what you expected
   - Any error messages (exact wording helps!)
   - What device/browser you used (e.g., "iPhone Safari" or "laptop Chrome")
3. **How long it took** (roughly)
4. **How it felt** — Was anything confusing? Any suggestions?

---

## Quick Reference: Test Card

If you need the test card again:

```
Card:   4242 4242 4242 4242
Expiry: 12/27
CVC:    123
ZIP:    14607
```

## Troubleshooting

| Problem                      | Try This                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| "Memberships paused" message | Make sure URL ends with `?key=show-pricing-table`                                     |
| Payment declined             | Card must be exactly `4242 4242 4242 4242`                                            |
| No welcome email             | Check spam folder. Wait 5 minutes. Tell Mark.                                         |
| Password link expired        | Go to `members.doulacooperative.com`, click "Forgot your password?", enter your email |
| Can't sign in                | Try "Forgot your password?" to reset it                                               |
| Profile form won't submit    | Make sure Name, Bio, and at least 1 category checkbox are filled                      |
| Page won't load              | Try refreshing. Try a different browser. Tell Mark.                                   |
