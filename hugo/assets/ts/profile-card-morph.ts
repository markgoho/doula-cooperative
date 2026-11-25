// Profile card morph: the one card being opened (or returned to) animates
// into the profile header. Only that card is named for the view transition.
// Naming every card made the browser snapshot hundreds of elements on each
// navigation, which held the next page back by about a second.
//
// Inlined render-blocking in <head>: pagereveal fires before the first frame,
// so a deferred script would miss it. The names themselves live in
// profile-card.css, keyed on the data-morph attribute set here.

const cardLinkingTo = (url: string): HTMLElement | undefined => {
  const { pathname } = new URL(url);
  const links = document.querySelectorAll<HTMLAnchorElement>(
    "a.profile-card__link",
  );

  for (const link of links) {
    if (link.pathname === pathname) {
      return link.closest<HTMLElement>(".profile-card-container") ?? undefined;
    }
  }

  return undefined;
};

const isOnScreen = (element: HTMLElement): boolean => {
  const { top, bottom } = element.getBoundingClientRect();

  return bottom > 0 && top < window.innerHeight;
};

// A page restored from the back/forward cache still carries the attribute from
// the last navigation; two named cards would cancel the transition.
const clearMorph = (): void => {
  for (const card of document.querySelectorAll<HTMLElement>("[data-morph]")) {
    delete card.dataset.morph;
  }
};

const morphCard = (
  transition: ViewTransition | null,
  otherPageUrl: string | undefined,
): void => {
  clearMorph();

  if (!transition || !otherPageUrl) {
    return;
  }

  const card = cardLinkingTo(otherPageUrl);

  // An off-screen card would fly in from outside the viewport.
  if (!card || !isOnScreen(card)) {
    return;
  }

  card.dataset.morph = "";
  void transition.finished.finally(clearMorph);
};

if ("navigation" in window) {
  window.addEventListener("pageswap", event => {
    morphCard(event.viewTransition, event.activation?.entry.url ?? undefined);
  });

  window.addEventListener("pagereveal", event => {
    const { activation } = window.navigation;

    morphCard(event.viewTransition, activation?.from?.url ?? undefined);
  });
}
