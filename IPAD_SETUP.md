# iPad setup

For the wall iPad. Written for (and tested on) an iPad Air 1st gen on iOS 12.5.8, the oldest it supports; newer iPads work the same way. Takes about 20 minutes.

## 1. Router: fixed address and no internet for the iPad

The iPad only needs to reach the Chore Quest server. Blocking its internet access keeps it from wandering off to the web, and removes any chance of the app quietly depending on the internet.

1. **Reserve an IP address for the iPad.** In your router's DHCP settings, add a reservation for the iPad's Wi-Fi address (on the iPad: Settings → General → About → **Wi-Fi Address**). Pick something easy, such as `192.168.0.50`.
2. **Reserve one for the server too**, so the iPad's bookmark never breaks, e.g. `192.168.0.10`.
3. **Add a firewall rule** blocking the iPad from the internet (WAN) while allowing the local network. In most routers this is under Firewall, Parental Controls, or Access Control:
   - Source: the iPad's IP (`192.168.0.50`)
   - Destination: WAN / Internet (any)
   - Action: **Block / Deny**

   Traffic to the server on the same network doesn't go through the WAN, so it keeps working. If your router can only do allow-lists, allow the iPad → `192.168.0.10` port `8080` and deny everything else.
4. **Check:** on the iPad, open Safari and try `apple.com` — it should fail. Then open `http://192.168.0.10:8080` — Chore Quest should load.

The iPad may show "No Internet Connection" under Wi-Fi. That's expected and harmless. The app's clock comes from the server, so the iPad's own clock drifting doesn't matter.

## 2. Add Chore Quest to the home screen

1. In Safari, open `http://<server IP>:8080` (e.g. `http://192.168.0.10:8080`).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Close Safari and launch **Chore Quest** from the home-screen icon (the treasure chest). It opens full screen with no Safari bars.
4. Optional check: in Safari, open `http://<server IP>:8080/#/check`. Tap **Quest** and **Sparkle**: you should hear sounds and see about 60 fps. Tap **Send report**; the server log will show the results. Tap **Done** to return.

## 3. Sound

- Make sure the **side switch** isn't set to Mute. If it mutes, web sounds are silent. Either flip it, or set it to lock rotation instead: Settings → General → **Use Side Switch To: Lock Rotation**.
- Turn the volume up with the side buttons while the app is open.
- The first tap after the app opens turns sound on (iOS rule). Until then the dashboard says "Tap anywhere to turn on sounds"; tap once after reopening the app so a Super Bonus fanfare plays the moment it arrives.

## 4. Keep the screen on

Settings → Display & Brightness → **Auto-Lock → Never**.

The app dims itself to a dark clock from 9 PM to 5 AM (Parent Mode → Settings → Night mode). Tapping wakes it.

Also consider Settings → Display & Brightness → turning brightness down a bit, to be easier on the panel.

## 5. Lock the iPad into the app (Guided Access)

1. Settings → General → Accessibility → **Guided Access** → On.
2. **Passcode Settings → Set Guided Access Passcode.** Use something the kids don't know (different from the parent PIN).
3. Turn **Accessibility Shortcut** on (triple-click the Home button).
4. Optional: **Time Limits → Sound** off, and Display Auto-Lock → **Never** if offered.
5. Open Chore Quest from the home screen, then **triple-click the Home button** → **Options**:
   - **Sleep/Wake Button**: off
   - **Volume Buttons**: off (after setting the volume)
   - **Motion**: off (keeps it in portrait)
   - **Keyboards**: off
   - **Touch**: on
6. Tap **Start**.

To exit Guided Access: triple-click Home and enter the Guided Access passcode.

## 6. Quiet the iPad

- **Notifications:** Settings → Notifications → turn off **Show Previews** and turn off notifications for each app (Guided Access also suppresses them).
- **Siri:** Settings → Siri & Search → turn off **Press Home for Siri** and **Listen for "Hey Siri"**.
- **Control Center:** Settings → Control Center → turn off **Access Within Apps**.
- **Do Not Disturb:** Settings → Do Not Disturb → **On** (or Scheduled, always).
- **Updates:** there are none for this iPad, but turn off Settings → iTunes & App Store → automatic downloads anyway.

## 7. First run

1. Tap the gear icon (bottom right of the dashboard) and enter the parent PIN from `household.json` (`0000` in the example). You'll be asked to choose a new one — cover the screen, little eyes are watching.
2. Parent Mode → **Chores**: set real values, mark any optional ones as **Bonus**, and set shared ones (feeding a pet, say) to **Whoever does it first** if that's how your house works.
3. Parent Mode → **Settings**: change the kids' PINs from the starting ones in `household.json`, pick avatars, set a weekly cap if you want one.
4. On your phone, bookmark `http://<server IP>:8080/parent` for the full parent view (exports, backups, import).

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank screen or "failed to start" | Check the server log (`docker compose logs`) for lines with `"client":true` — iPad errors are reported there. |
| "Reconnecting…" badge | The iPad can't reach the server. Check the server is up (`/healthz`) and the firewall rule didn't block the LAN. |
| No sound | Side switch on Mute, volume down, or Settings → Sound off in Parent Mode. Tap once to wake audio. |
| Old version after an update | Close the app (double-click Home, swipe it away) and reopen. |
| Kid locked out | 5 wrong PINs lock that login for 30 seconds. |
