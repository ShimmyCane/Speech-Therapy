# Felix's Sounds: decisions

Questions and answers from review. Each answer is a decision to build against.

1. **Where do recordings live?**
   Re-recorded clips are saved to the shared Supabase storage bucket (`speech-therapy`, which needs sign-in), and Felix's app plays them.
   - *Open point:* the Voice Booth currently has no sign-in, so the upload step needs one. See question 2.

2. **Who can open the editing page?**
   Anyone with the link can open it and edit words and recordings. No PIN.
   - Only audio files are accepted.
   - Clips longer than **10 seconds** are not accepted. They are flagged instead of saved.

3. **What do speed and pitch mean for Felix?**
   - Speed order is **0.5×, 0.75×, 1×**, in that order on screen.
   - Pitch stays the same. Speed changes the pace only, and the voice's pitch does not shift with it.
   - Speed and pitch controls move onto the lesson screen where Felix can pick them.
   - Labels are not yet decided. The current `Lower / Same / Higher` labels are kept until a decision is made.

4. **What does a new lesson need?**
   - New lessons start as a **draft** that only grown-ups see until someone approves them.
   - The "Create lesson" button stays on the front page.
   - Felix's lesson suggestions are based on how well he has been doing. This needs a ranking library or framework for lesson results.
   - At the end of each lesson, Felix (or a grown-up) rates how difficult it was on a **1–10** scale. The rating feeds the ranking.
   - *Still to confirm:* the fields a new lesson asks for (track, lesson number, title, focus sounds, mouth text, words).

5. **What happens when Felix taps a word?**
   Lesson flow is streamlined to:
   1. **Tap a word** and hear it (at the chosen speed and pitch).
   2. **Countdown 3, 2, 1** (1.5 seconds in total), then record.
   3. **Review and star.**
   - The Listen button is removed.
   - The larger font applies to **both English and Chinese** words. Chinese is 3× the current size, and English is enlarged to match.
