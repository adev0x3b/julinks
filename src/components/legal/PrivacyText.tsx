import Link from "next/link";
import { CLOSED_ACCOUNT_RETENTION_DAYS } from "@/lib/data/accounts";
import { MESSAGE_RETENTION_DAYS } from "@/lib/data/contact";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * The privacy notice. The numbers come from the code that enforces them, so the text cannot drift
 * from what the app does. Who runs the site and which providers it uses come from the environment.
 */
export type PrivacyFacts = { operator: string | null; processors: string | null; mail: boolean };

const SESSION_DAYS = 7;

export function PrivacyEnglish({ operator, processors, mail }: PrivacyFacts) {
  return (
    <>
      <h2>Who is responsible</h2>
      <p>
        This site is run by {operator ?? "the operator of this site"}, who decides how the data below is used (the data controller under the
        GDPR). For any question or request about your data, write through the <Link href="/contact?kind=privacy">contact form</Link>.
      </p>

      <h2>What is kept, why and for how long</h2>
      <ul>
        <li>
          <strong>Your account</strong>, if you request one: email, username, display name, bio, your password (only as a one-way hash), your
          role, and when you signed up and were reviewed. It is needed to run your account (GDPR art. 6(1)(b)) and kept until you delete the
          account. Denied requests and closed accounts are deleted {CLOSED_ACCOUNT_RETENTION_DAYS} days after the decision.
        </li>
        <li>
          <strong>Your page</strong>: links, folders, social icons, pictures and themes. They are public by design, and kept until you remove
          them or delete the account.
        </li>
        {mail && (
          <li>
            <strong>Unconfirmed sign-ups</strong>: email, username and password hash, until the confirmation link is used, and at most 24 hours.
          </li>
        )}
        <li>
          <strong>Clicks on links</strong>: the time, and the name of the site the visitor reached the page from (for example instagram.com),
          which the page passes along with the click. Only the site name is kept, never the full address. No cookie, IP address or identifier
          is involved, so visitors cannot be told apart. Kept as long as the link exists.
        </li>
        {mail && (
          <li>
            <strong>Mail sent by the site</strong> (confirmations, password resets, decisions on requests): the address, subject and text,
            kept 7 days after sending, or 30 days if sending failed, to stay within the mail provider&apos;s limits. The links inside
            confirmation and reset mails are erased as soon as the mail is out.
          </li>
        )}
        <li>
          <strong>Contact form messages</strong>: what you write, the page it is about and, if you give it, your email. Only admins read them.
          They are deleted once dealt with, and after {MESSAGE_RETENTION_DAYS} days at the latest.
        </li>
        <li>
          <strong>IP addresses</strong> are held in the server&apos;s memory for about an hour at most, to limit login attempts and form spam. They
          are never written to the database. This is a legitimate interest in keeping the site secure (GDPR art. 6(1)(f)).
        </li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <ul>
        <li>
          One cookie, <code>{SESSION_COOKIE}</code>, set when you log in, keeps you logged in for up to {SESSION_DAYS} days. It is strictly
          necessary, so no consent is asked for it.
        </li>
        <li>The light or dark choice in the dashboard is kept in your browser&apos;s local storage and never sent to the server.</li>
        <li>There is no analytics, advertising or third-party script.</li>
      </ul>

      <h2>Who else handles the data</h2>
      {processors ? (
        <p>
          These providers handle data on the site&apos;s behalf, under data processing agreements: {processors}. Some are based outside the EU;
          those transfers rely on the EU–US Data Privacy Framework or on the European Commission&apos;s standard contractual clauses.
        </p>
      ) : (
        <p>The data stays on the server that runs this site. Nothing is sold or shared with anyone.</p>
      )}

      <h2>Your rights</h2>
      <p>
        You can see and correct your data in the dashboard, download all of it from the Account page, and delete your account there at any
        time. For anything else (access, correction, erasure, restriction, objection or portability) use the{" "}
        <Link href="/contact?kind=privacy">contact form</Link>; you get an answer within one month. You can also complain to a data protection
        authority: in Italy, the{" "}
        <a href="https://www.garanteprivacy.it" rel="noreferrer">
          Garante per la protezione dei dati personali
        </a>
        .
      </p>

      <h2>Age</h2>
      <p>JuLinks accounts are not meant for anyone under 14.</p>

      <h2>Changes</h2>
      <p>When this notice changes, so does the date at the top.</p>
    </>
  );
}

export function PrivacyItalian({ operator, processors, mail }: PrivacyFacts) {
  return (
    <>
      <h2>Titolare del trattamento</h2>
      <p>
        Questo sito è gestito da {operator ?? "chi gestisce questo sito"}, che decide come vengono usati i dati descritti qui sotto
        (titolare del trattamento ai sensi del GDPR). Per qualsiasi domanda o richiesta sui tuoi dati scrivi tramite il{" "}
        <Link href="/contact?kind=privacy">modulo di contatto</Link>.
      </p>

      <h2>Quali dati, perché e per quanto tempo</h2>
      <ul>
        <li>
          <strong>Il tuo account</strong>, se ne chiedi uno: email, nome utente, nome visualizzato, bio, la password (solo come hash non
          reversibile), il ruolo, la data di iscrizione e quella della revisione. Servono a gestire il tuo account (art. 6(1)(b) GDPR) e
          restano finché non elimini l&apos;account. Le richieste rifiutate e gli account chiusi vengono eliminati{" "}
          {CLOSED_ACCOUNT_RETENTION_DAYS} giorni dopo la decisione.
        </li>
        <li>
          <strong>La tua pagina</strong>: link, cartelle, icone social, immagini e temi. Sono pubblici per natura e restano finché non li
          rimuovi o non elimini l&apos;account.
        </li>
        {mail && (
          <li>
            <strong>Iscrizioni non confermate</strong>: email, nome utente e hash della password, finché il link di conferma non viene usato, e
            al massimo 24 ore.
          </li>
        )}
        <li>
          <strong>Clic sui link</strong>: l&apos;ora e il nome del sito da cui il visitatore è arrivato alla pagina (per esempio
          instagram.com), che la pagina trasmette insieme al clic. Si conserva solo il nome del sito, mai l&apos;indirizzo completo. Nessun
          cookie, indirizzo IP o identificativo: i visitatori non sono distinguibili. Restano finché esiste il link.
        </li>
        {mail && (
          <li>
            <strong>Email inviate dal sito</strong> (conferme, reimpostazione password, esito delle richieste): indirizzo, oggetto e testo,
            conservati 7 giorni dopo l&apos;invio, o 30 se l&apos;invio non riesce, per rispettare i limiti del fornitore di posta. I link
            contenuti nelle email di conferma e di reimpostazione vengono cancellati appena l&apos;email parte.
          </li>
        )}
        <li>
          <strong>Messaggi del modulo di contatto</strong>: quello che scrivi, la pagina a cui si riferisce e, se la indichi, la tua email. Li
          leggono solo gli amministratori. Vengono eliminati una volta gestiti, e comunque dopo {MESSAGE_RETENTION_DAYS} giorni.
        </li>
        <li>
          <strong>Indirizzi IP</strong>: restano nella memoria del server per circa un&apos;ora al massimo, per limitare i tentativi di accesso e lo spam
          nei moduli. Non vengono mai salvati nel database. La base giuridica è il legittimo interesse alla sicurezza del sito (art. 6(1)(f)
          GDPR).
        </li>
      </ul>

      <h2>Cookie e memoria del browser</h2>
      <ul>
        <li>
          Un solo cookie, <code>{SESSION_COOKIE}</code>, impostato quando accedi, ti mantiene collegato fino a {SESSION_DAYS} giorni. È un
          cookie tecnico strettamente necessario, quindi non serve il consenso.
        </li>
        <li>
          La scelta tra tema chiaro e scuro nella dashboard resta nella memoria locale del tuo browser e non viene mai inviata al server.
        </li>
        <li>Non ci sono strumenti di analisi, pubblicità o script di terze parti.</li>
      </ul>

      <h2>Chi altro tratta i dati</h2>
      {processors ? (
        <p>
          Questi fornitori trattano dati per conto del sito, sulla base di accordi di trattamento dei dati: {processors}. Alcuni hanno sede
          fuori dall&apos;UE; questi trasferimenti si basano sull&apos;EU–US Data Privacy Framework o sulle clausole contrattuali tipo della
          Commissione europea.
        </p>
      ) : (
        <p>I dati restano sul server che fa funzionare questo sito. Non vengono venduti né condivisi con nessuno.</p>
      )}

      <h2>I tuoi diritti</h2>
      <p>
        Puoi vedere e correggere i tuoi dati nella dashboard, scaricarli tutti dalla pagina Account ed eliminare l&apos;account in qualsiasi
        momento dalla stessa pagina. Per tutto il resto (accesso, rettifica, cancellazione, limitazione, opposizione o portabilità) usa il{" "}
        <Link href="/contact?kind=privacy">modulo di contatto</Link>: riceverai risposta entro un mese. Puoi anche presentare reclamo al{" "}
        <a href="https://www.garanteprivacy.it" rel="noreferrer">
          Garante per la protezione dei dati personali
        </a>
        .
      </p>

      <h2>Età</h2>
      <p>Gli account JuLinks non sono pensati per chi ha meno di 14 anni.</p>

      <h2>Modifiche</h2>
      <p>Quando questa informativa cambia, cambia anche la data in alto.</p>
    </>
  );
}
