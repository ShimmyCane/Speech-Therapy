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

## To do (testing)

- [ ] Roll back the draft-lesson testing notes if they no longer apply. Check the ⚙️ "Try draft lessons (not yet approved)" toggle and the home-page message "No lessons are published yet. A grown-up can try drafts from ⚙️." Now that the Voice Booth is in ⚙️ and new lessons can be created, these may need new wording or removal.
- [ ] Test on the iPad: tap a word to hear it, the 3-2-1 countdown, and recording.
- [ ] Test uploads from the Voice Booth and check the Supabase storage rules allow them.
- [ ] Test creating a new draft lesson and check the table rules allow it.
- [ ] Switch GitHub Pages from the feature branch to `main`.
- [ ] Test a full lesson end to end: draft lessons (⚙️ "Try draft lessons"), record, play back, then publish.
- [ ] Decide how the lesson audio is produced. The device voice does not match the sound Felix needs. Options to compare: recorded grown-up clips for every word, a better text-to-speech voice, or both.
- [ ] Check the mouth-position guide with a speech therapist. TH has no clear placement in the sources used. The guide is at https://claude.ai/artifact/2FUYrFzWSQQVXftmqmebW2 and is not yet in the repo.
