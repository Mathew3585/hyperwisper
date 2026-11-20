//! Light filler-word removal: the verbal tics that read fine out loud and
//! odd on the page ("du coup", "euh", ", quoi.").
//!
//! Deliberately conservative. Each rule only fires in a context where the
//! word can't be carrying meaning — "du coup" goes, "du coup de poing"
//! stays; a standalone "Voilà." goes, "voilà le fichier" stays. Deleting a
//! word the user meant is a worse failure than leaving a tic in, so anything
//! that's a real connector most of the time ("donc", "alors", "en fait") is
//! not touched at this level.
//!
//! Works on byte spans of the original text: everything that isn't a removed
//! filler (or the punctuation it leaves dangling) is copied through verbatim.

use crate::settings::FillerRemoval;

/// Above this share of removed words, the "fillers" were probably the point
/// of the dictation (or the rules misfired) — paste the original instead.
const MAX_REMOVED_PCT: usize = 40;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Word,
    Punct,
}

struct Tok<'a> {
    text: &'a str,
    start: usize,
    end: usize,
    kind: Kind,
}

impl Tok<'_> {
    fn is(&self, s: &str) -> bool {
        self.text == s
    }
    fn is_word(&self) -> bool {
        self.kind == Kind::Word
    }
    fn lower(&self) -> String {
        self.text.to_lowercase().replace('’', "'")
    }
}

/// When a matched filler may actually be removed.
#[derive(Clone, Copy)]
enum When {
    /// Pure hesitation sounds — never a real word.
    Always,
    /// Interjection that's also a name ("ben" / "Ben"): lowercase, or
    /// followed directly by punctuation.
    LowercaseOrBeforePunct,
    /// "du coup", unless "coup" is the noun ("du coup de poing", "à cause
    /// du coup").
    DuCoup,
    /// A clause on its own: start or punctuation before it, and a comma,
    /// full stop or the end after it. A "?" after it keeps it, since the
    /// question mark belongs to the tag ("C'est bizarre, tu vois ?").
    Standalone,
    /// A tag closing a sentence after a comma: "C'est bien, quoi."
    CommaTail,
}

struct Rule {
    words: &'static [&'static str],
    when: When,
}

const fn rule(words: &'static [&'static str], when: When) -> Rule {
    Rule { words, when }
}

// Multi-word rules first so they win over any single-word prefix.
const FR: &[Rule] = &[
    rule(&["du", "coup"], When::DuCoup),
    rule(&["tu", "vois"], When::Standalone),
    rule(&["tu", "sais"], When::Standalone),
    rule(&["vous", "voyez"], When::Standalone),
    rule(&["vous", "savez"], When::Standalone),
    rule(&["euh"], When::Always),
    rule(&["heu"], When::Always),
    rule(&["euhm"], When::Always),
    rule(&["hum"], When::Always),
    rule(&["hmm"], When::Always),
    rule(&["bah"], When::Always),
    rule(&["ben"], When::LowercaseOrBeforePunct),
    rule(&["voilà"], When::Standalone),
    rule(&["quoi"], When::CommaTail),
];

const EN: &[Rule] = &[
    rule(&["you", "know"], When::Standalone),
    rule(&["um"], When::Always),
    rule(&["umm"], When::Always),
    rule(&["uh"], When::Always),
    rule(&["uhm"], When::Always),
    rule(&["erm"], When::Always),
    rule(&["hmm"], When::Always),
];

// Other languages: hesitation sounds only, until someone who speaks them
// curates the contextual tics.
const ES: &[Rule] = &[
    rule(&["ehm"], When::Always),
    rule(&["eeh"], When::Always),
    rule(&["mmm"], When::Always),
];
const DE: &[Rule] = &[
    rule(&["äh"], When::Always),
    rule(&["ähm"], When::Always),
    rule(&["öhm"], When::Always),
    rule(&["hmm"], When::Always),
];
const PT: &[Rule] = &[
    rule(&["hã"], When::Always),
    rule(&["ahn"], When::Always),
    rule(&["hmm"], When::Always),
];

/// Words that, right before "du coup", make "coup" a noun: "à cause du
/// coup", "la violence du coup".
const COUP_NOUN_CONTEXT: &[&str] = &[
    "cause", "suite", "effet", "force", "violence", "auteur", "auteurs", "bruit", "choc", "lors",
    "impact", "puissance", "sous",
];

/// Conjunctions that can't take a comma right after them: when a filler
/// between one and a comma goes, the comma goes too ("et du coup, mettre"
/// → "et mettre", not "et, mettre").
const CONNECTORS: &[&str] = &[
    "et", "mais", "ou", "donc", "car", "que", "qu'", "puis", "and", "but", "or", "so", "that",
    "because",
];

fn rules_for(language: &str) -> &'static [Rule] {
    match language.get(..2).map(str::to_ascii_lowercase).as_deref() {
        Some("fr") => FR,
        Some("en") => EN,
        Some("es") => ES,
        Some("de") => DE,
        Some("pt") => PT,
        _ => &[],
    }
}

/// Remove filler words from a transcript. `language` is a Whisper code
/// ("fr", "en"…); languages without a rule table are returned unchanged.
/// Returns the cleaned text and how many words were removed.
pub fn remove_fillers(text: &str, language: &str, mode: FillerRemoval) -> (String, u32) {
    if mode == FillerRemoval::Off {
        return (text.to_string(), 0);
    }
    let rules = rules_for(language);
    if rules.is_empty() {
        return (text.to_string(), 0);
    }

    let toks = tokenize(text);
    let mut removed = vec![false; toks.len()];
    let mut runs: Vec<(usize, usize)> = Vec::new();

    let mut i = 0;
    while i < toks.len() {
        if !toks[i].is_word() {
            i += 1;
            continue;
        }
        let prev = prev_kept(&removed, i).map(|p| &toks[p]);
        match rules.iter().find_map(|r| match_rule(&toks, i, r, prev)) {
            Some(n) => {
                removed[i..i + n].iter_mut().for_each(|r| *r = true);
                runs.push((i, i + n));
                i += n;
            }
            None => i += 1,
        }
    }
    if runs.is_empty() {
        return (text.to_string(), 0);
    }

    let total_words = toks.iter().filter(|t| t.is_word()).count();
    let removed_words = toks.iter().zip(&removed).filter(|(t, r)| **r && t.is_word()).count();
    if removed_words == total_words || removed_words * 100 > total_words * MAX_REMOVED_PCT {
        return (text.to_string(), 0);
    }

    for &(a, b) in &runs {
        drop_trailing_ellipsis(&toks, &mut removed, b);

        let p = prev_kept(&removed, a);
        let n = next_kept(&removed, b);
        let p_tok = p.map(|p| &toks[p]);
        let n_tok = n.map(|n| &toks[n]);
        let at_start = p_tok.map_or(true, |t| is_terminator(t) || t.is(","));
        let after_connector =
            p_tok.is_some_and(|t| t.is_word() && CONNECTORS.contains(&t.lower().as_str()));
        let comma_next = n_tok.is_some_and(|t| t.is(","));
        if let Some(n) = n.filter(|_| comma_next && (at_start || after_connector)) {
            // "Ok, du coup, je" → "Ok, je"; "Du coup, je" → "je";
            // "et du coup, mettre" → "et mettre"
            removed[n] = true;
        } else if let Some(p) = p.filter(|_| {
            p_tok.is_some_and(|t| t.is(",")) && n_tok.map_or(true, is_terminator)
        }) {
            // "C'est bien, quoi." → "C'est bien."
            removed[p] = true;
        } else if let Some(n) = n.filter(|_| {
            p_tok.map_or(true, is_sentence_end) && n_tok.is_some_and(|t| matches!(t.text, "." | "!" | "…"))
        }) {
            // "On verra bien. Voilà. Mais" → "On verra bien. Mais"
            removed[n] = true;
        }
    }

    // A filler that opened a sentence hands its capital to the word now
    // starting it ("Du coup je teste" → "Je teste"). Done once every removal
    // is settled, so stacked openers ("Bah, du coup, on…") resolve too.
    let mut capitalize = vec![false; toks.len()];
    for &(a, b) in &runs {
        let opened_sentence = prev_kept(&removed, a).map_or(true, |p| is_sentence_end(&toks[p]));
        let was_capital = toks[a].text.chars().next().is_some_and(char::is_uppercase);
        if opened_sentence && was_capital {
            if let Some(n) = next_kept(&removed, b).filter(|&n| toks[n].is_word()) {
                capitalize[n] = true;
            }
        }
    }

    (rebuild(text, &toks, &removed, &capitalize), removed_words as u32)
}

/// Length of the filler matched at `i`, if `rule` matches there in context.
fn match_rule(toks: &[Tok], i: usize, rule: &Rule, prev: Option<&Tok>) -> Option<usize> {
    let n = rule.words.len();
    let span = toks.get(i..i + n)?;
    if !span.iter().zip(rule.words).all(|(t, w)| t.is_word() && t.lower() == *w) {
        return None;
    }
    let next = toks.get(i + n);
    let boundary_before = prev.map_or(true, |t| !t.is_word());

    let ok = match rule.when {
        When::Always => true,
        When::LowercaseOrBeforePunct => {
            toks[i].text.chars().all(char::is_lowercase) || next.is_some_and(|t| !t.is_word())
        }
        When::DuCoup => {
            let noun_follows = next.is_some_and(|t| {
                let w = t.lower();
                t.is_word() && (matches!(w.as_str(), "de" | "du" | "des") || w.starts_with("d'"))
            });
            let noun_before = prev.is_some_and(|t| {
                t.is_word() && COUP_NOUN_CONTEXT.contains(&t.lower().as_str())
            });
            !noun_follows && !noun_before
        }
        When::Standalone => {
            boundary_before
                && next.map_or(true, |t| matches!(t.text, "," | "." | "!" | "…" | ";"))
        }
        When::CommaTail => {
            prev.is_some_and(|t| t.is(",")) && next.map_or(true, |t| matches!(t.text, "." | "!" | "…"))
        }
    };
    ok.then_some(n)
}

/// "Euh... je pense" → the ellipsis that trailed the hesitation goes too.
fn drop_trailing_ellipsis(toks: &[Tok], removed: &mut [bool], from: usize) {
    let Some(n) = next_kept(removed, from) else { return };
    if toks[n].is("…") {
        removed[n] = true;
        return;
    }
    let dots = toks[n..].iter().take_while(|t| t.is(".")).count();
    if dots >= 2 {
        removed[n..n + dots].iter_mut().for_each(|r| *r = true);
    }
}

fn is_sentence_end(t: &Tok) -> bool {
    matches!(t.text, "." | "!" | "?" | "…")
}

fn is_terminator(t: &Tok) -> bool {
    matches!(t.text, "." | "!" | "?" | "…" | ";" | ":")
}

fn prev_kept(removed: &[bool], before: usize) -> Option<usize> {
    (0..before).rev().find(|&j| !removed[j])
}

fn next_kept(removed: &[bool], from: usize) -> Option<usize> {
    (from..removed.len()).find(|&j| !removed[j])
}

/// Words are runs of letters/digits with inner apostrophes and hyphens
/// ("l'aplique", "peut-être"); every other non-space char is its own token.
fn tokenize(s: &str) -> Vec<Tok<'_>> {
    let mut toks = Vec::new();
    let mut it = s.char_indices().peekable();
    while let Some((i, c)) = it.next() {
        if c.is_whitespace() {
            continue;
        }
        let mut end = i + c.len_utf8();
        let kind = if c.is_alphanumeric() {
            while let Some(&(j, d)) = it.peek() {
                if d.is_alphanumeric() || matches!(d, '\'' | '’' | '-') {
                    end = j + d.len_utf8();
                    it.next();
                } else {
                    break;
                }
            }
            Kind::Word
        } else {
            Kind::Punct
        };
        toks.push(Tok { text: &s[i..end], start: i, end, kind });
    }
    toks
}

/// Copy kept tokens through with the whitespace that originally preceded
/// them. Leading whitespace is dropped; a word that ends up glued to the
/// previous token by a removal gets a single space.
fn rebuild(text: &str, toks: &[Tok], removed: &[bool], capitalize: &[bool]) -> String {
    let mut out = String::with_capacity(text.len());
    let mut gap_dirty = false;
    for (i, t) in toks.iter().enumerate() {
        if removed[i] {
            gap_dirty = true;
            continue;
        }
        if !out.is_empty() {
            let gap = &text[toks[i - 1].end..t.start];
            if gap_dirty && gap.is_empty() && t.is_word() {
                out.push(' ');
            } else {
                out.push_str(gap);
            }
        }
        if capitalize[i] {
            let mut chars = t.text.chars();
            if let Some(first) = chars.next() {
                out.extend(first.to_uppercase());
                out.push_str(chars.as_str());
            }
        } else {
            out.push_str(t.text);
        }
        gap_dirty = false;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fr(s: &str) -> String {
        remove_fillers(s, "fr", FillerRemoval::Light).0
    }

    // ── Removed ─────────────────────────────────────────────────────────

    #[test]
    fn strips_du_coup_from_real_dictations() {
        assert_eq!(
            fr("Ok bah du coup je teste avec la voix un petit peu basse."),
            "Ok je teste avec la voix un petit peu basse."
        );
        assert_eq!(
            fr("Hello, du coup j'aimerais que tu fasses un petit peu le tour."),
            "Hello, j'aimerais que tu fasses un petit peu le tour."
        );
        assert_eq!(
            fr("Ok, go pour le style D2 du coup, mais j'aimerais une autre version."),
            "Ok, go pour le style D2, mais j'aimerais une autre version."
        );
    }

    #[test]
    fn collapses_the_commas_a_filler_leaves_behind() {
        assert_eq!(
            fr("Ok, alors, du coup, je te fais le message."),
            "Ok, alors, je te fais le message."
        );
        assert_eq!(fr("C'est bien, quoi."), "C'est bien.");
        assert_eq!(fr("Ça marche, tu vois, c'est rapide."), "Ça marche, c'est rapide.");
        assert_eq!(
            fr("On va créer un exe et du coup, mettre ça sur un repo privé."),
            "On va créer un exe et mettre ça sur un repo privé."
        );
        assert_eq!(
            fr("Ok, go pour le style D2 du coup, mais en version claire."),
            "Ok, go pour le style D2, mais en version claire."
        );
    }

    #[test]
    fn a_standalone_sentence_leaves_no_double_full_stop() {
        assert_eq!(
            fr("Fais la vidéo avec les icônes et on verra bien. Voilà. Mais laisse le texte. Voilà."),
            "Fais la vidéo avec les icônes et on verra bien. Mais laisse le texte."
        );
    }

    #[test]
    fn hands_the_capital_to_the_new_first_word() {
        assert_eq!(fr("Du coup je teste le micro."), "Je teste le micro.");
        assert_eq!(
            fr("Bah, du coup, on y va demain vers dix heures."),
            "On y va demain vers dix heures."
        );
        assert_eq!(fr("C'est fait. Du coup on passe à la suite."), "C'est fait. On passe à la suite.");
    }

    #[test]
    fn strips_hesitations_and_their_ellipsis() {
        assert_eq!(fr("Je pense que euh... ça marche bien."), "Je pense que ça marche bien.");
        assert_eq!(fr("Euh, on se voit demain à midi."), "On se voit demain à midi.");
    }

    #[test]
    fn strips_a_closing_standalone_voila() {
        assert_eq!(fr("J'ai fini le rapport hier soir, voilà."), "J'ai fini le rapport hier soir.");
    }

    #[test]
    fn english_hesitations() {
        let (out, n) = remove_fillers("So um I think, you know, it works fine.", "en", FillerRemoval::Light);
        assert_eq!(out, "So I think, it works fine.");
        assert_eq!(n, 3);
    }

    // ── Kept: the words carry meaning here ──────────────────────────────

    #[test]
    fn keeps_coup_as_a_noun() {
        for s in [
            "Il a reçu un coup du coup de poing.",
            "Il a mal à cause du coup qu'il a reçu.",
            "C'est l'auteur du coup d'État.",
            "Il parle du coup des dominos.",
        ] {
            assert_eq!(fr(s), s);
        }
    }

    #[test]
    fn keeps_words_used_for_their_meaning() {
        for s in [
            "Voilà le fichier que tu m'as demandé.",
            "Tu fais quoi ce soir ?",
            "Tu vois la maison au bout de la rue ?",
            "Tu sais pourquoi il est parti ?",
            "C'est bizarre, tu vois ?",
            "Donc il faut relancer le serveur.",
            "En fait, non, ce n'est pas ça.",
            "Ben est arrivé ce matin.",
        ] {
            assert_eq!(fr(s), s);
        }
    }

    #[test]
    fn leaves_text_without_fillers_byte_identical() {
        let s = "Bonjour ,  ceci est   un test ?";
        assert_eq!(remove_fillers(s, "fr", FillerRemoval::Light), (s.to_string(), 0));
    }

    // ── Safety nets ─────────────────────────────────────────────────────

    #[test]
    fn keeps_the_original_when_fillers_are_most_of_it() {
        assert_eq!(fr("Du coup, voilà."), "Du coup, voilà.");
        assert_eq!(fr("Ok bah du coup."), "Ok bah du coup.");
    }

    #[test]
    fn off_and_unknown_languages_are_untouched() {
        let s = "Du coup je teste le micro.";
        assert_eq!(remove_fillers(s, "fr", FillerRemoval::Off).0, s);
        assert_eq!(remove_fillers(s, "it", FillerRemoval::Light).0, s);
        assert_eq!(remove_fillers(s, "", FillerRemoval::Light).0, s);
    }

    #[test]
    fn handles_degenerate_text() {
        for s in ["", " ", "...", "?", "du", "coup"] {
            let _ = fr(s);
        }
    }
}
