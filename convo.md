# Felix's Sounds: open questions

Five questions to answer before the next round of changes. Replies can be short.

1. **Where do recordings live?**
   When a grown-up re-records a word in the editing page, should the clip be saved to the shared Supabase storage bucket (`speech-therapy`, which needs sign-in) so Felix's app plays it, or is a download to this device enough for now? Right now the app only speaks with the device's built-in voice, and the Voice Booth never reaches Felix's app.

2. **Who can open the editing page?**
   The editing page (the Voice Booth) is at `/public/booth.html`. Once Pages is live, anyone with the link can open it. Should it be hidden behind a simple PIN, or is an unlinked URL enough?

3. **What do speed and pitch mean for Felix?**
   Speed (0.75×, 0.5×, 1×) changes how fast the voice speaks. Pitch (Lower, Same, Higher) changes how high or low the voice sounds. Should these stay as grown-up settings in the gear panel, or move onto the lesson screen where Felix can pick them? Should the labels change to something a 6-year-old reads easily, such as "Slow / Normal" and "Deep / Normal / High"?

4. **What does a new lesson need?**
   For the "Create lesson" button on the front page, should a new lesson ask only for: track (English or 中文), lesson number, title, the sounds it focuses on, the mouth picture text, and the words? Should it start as a draft that only grown-ups see until someone approves it?

5. **What happens when Felix taps a word?**
   You asked for tapping a word to hear it, and for the Listen button to go. Should tapping a word play it (at the chosen speed and pitch) and then move Felix on to "Say it", so the lesson still runs Listen → Say → Stars? And for the 3× Chinese words, should the bigger size apply only to Chinese lessons, or to English words too?
