# Guided tour (familiarization)

This is a port of the Scenario Creator's `familiarizzazione`, adapted to the device UI under `device/`. Each step shows a card in Italian and English and highlights the part of the screen it talks about. Where a step has a "Try it" box, it ticks by itself when the learner does the action. "Next" always works, even if the action was not done.

The tour only watches the app and never changes it. It reads the app state through `context`, finds the parts of the screen through CSS selectors, and listens for clicks.

The selectors come mostly from two places:

- the `data-fam` hooks that came with the ported `Ventilatore.tsx`, plus its `.simvent__*` classes;
- the `data-testid` attributes in the start and setup screens.

The only attribute added for the tour is `data-tour="esci"` on the ventilator's back arrow.

## How it is wired

`device/DeviceApp.tsx` mounts the tour once, beside whatever screen is showing. Because the mount point is stable, the tour keeps its current step while the screens change underneath it.

```tsx
<Tour active={tourActive} onClose={() => setTourActive(false)}
      context={{ screen, icuChoice, ambiente, vent, actions: tourActions }} />
```

`tourActions` holds the learner's recent actions, named with `nomeAzione` (for example `vent-silenzia` or `vent-modalita:PC`). Steps use these names to tick "Try it".

The "Guida passo passo / Guided tour" button on `StartupScreen` starts the tour. If you also pass the `onStartTour` prop, it is still called.

## Steps

The steps that appear depend on the environment (`anestesia`, `invasiva`, `niv`, `alto-flusso`). The start-up steps (choose the device, ICU invasive or NIV, patient) appear only before the machine is running. A step stays in the list once it has been shown, so the "n/N" counter only goes forward.

To add a step, add it to `TOUR_STEPS` in `steps.ts` with both `it` and `en` texts. `tests/tour.test.ts` checks that both languages are filled in, that ids are unique, and which steps each environment gets.

## Keys

- Esc closes the tour.
- ← and → go back and forward.
- "–" hides the guide to a tab on the left edge.
