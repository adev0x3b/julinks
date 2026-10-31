import Link from "next/link";
import { CLOSED_ACCOUNT_RETENTION_DAYS } from "@/lib/data/accounts";

/** The terms of use. Who runs the site comes from the environment (SITE_OPERATOR). */
export type TermsFacts = { operator: string | null };

export function TermsEnglish({ operator }: TermsFacts) {
  return (
    <>
      <h2>The service</h2>
      <p>
        JuLinks gives you one public page for your links. It is free, invite only, and run by {operator ?? "the operator of this site"}. By
        requesting a page you accept these terms and the <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>Your account</h2>
      <p>You must be at least 14. Keep your password to yourself: you are responsible for what is done with your account.</p>

      <h2>Your content</h2>
      <p>
        What you put on your page stays yours. You allow the site to store it and show it to visitors, only to run the service. Everything on
        your page is public.
      </p>

      <h2>What is not allowed</h2>
      <ul>
        <li>Illegal content, or links to it.</li>
        <li>Malware, phishing, scams, or links that hide where they lead in order to deceive.</li>
        <li>Pretending to be someone else.</li>
        <li>Harassment, threats or hate against people or groups.</li>
        <li>Content that infringes someone else&apos;s rights, such as copyright or privacy.</li>
        <li>Misusing the site: spam, automated sign-ups, or attempts to break or overload it.</li>
      </ul>

      <h2>Reports and removal</h2>
      <p>
        Anyone can report a page through the <Link href="/contact?kind=report">contact form</Link>. Content or accounts that break these terms
        can be hidden, removed or closed. The owner is told why, unless the law or someone&apos;s safety says otherwise, and can ask for the
        decision to be reviewed through the same form.
      </p>

      <h2>Ending</h2>
      <p>
        You can delete your account at any time from the Account page. The site may close an account that breaks these terms, or stop the
        service; closed accounts are deleted {CLOSED_ACCOUNT_RETENTION_DAYS} days later.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided as it is, with no promise that it is always available or free of errors. As far as the law allows, the site is
        not liable for losses that come from using it.
      </p>

      <h2>Changes and law</h2>
      <p>
        These terms may change; the date at the top says when they last did. Italian law applies, without taking away the protection the law
        of your country gives you as a consumer.
      </p>
    </>
  );
}

export function TermsItalian({ operator }: TermsFacts) {
  return (
    <>
      <h2>Il servizio</h2>
      <p>
        JuLinks ti offre una pagina pubblica per i tuoi link. È gratuito, su invito, e gestito da {operator ?? "chi gestisce questo sito"}.
        Chiedendo una pagina accetti queste condizioni e l&apos;<Link href="/privacy">informativa sulla privacy</Link>.
      </p>

      <h2>Il tuo account</h2>
      <p>Devi avere almeno 14 anni. Non condividere la password: sei responsabile di ciò che viene fatto con il tuo account.</p>

      <h2>I tuoi contenuti</h2>
      <p>
        Ciò che pubblichi sulla tua pagina resta tuo. Permetti al sito di conservarlo e mostrarlo ai visitatori, solo per far funzionare il
        servizio. Tutto ciò che è sulla tua pagina è pubblico.
      </p>

      <h2>Cosa non è consentito</h2>
      <ul>
        <li>Contenuti illegali, o link a contenuti illegali.</li>
        <li>Malware, phishing, truffe, o link che nascondono dove portano per ingannare.</li>
        <li>Fingersi un&apos;altra persona.</li>
        <li>Molestie, minacce o odio verso persone o gruppi.</li>
        <li>Contenuti che violano i diritti altrui, come il diritto d&apos;autore o la privacy.</li>
        <li>Usare il sito in modo improprio: spam, iscrizioni automatiche, tentativi di romperlo o sovraccaricarlo.</li>
      </ul>

      <h2>Segnalazioni e rimozioni</h2>
      <p>
        Chiunque può segnalare una pagina tramite il <Link href="/contact?kind=report">modulo di contatto</Link>. Contenuti o account che
        violano queste condizioni possono essere nascosti, rimossi o chiusi. Il titolare viene informato del motivo, salvo che la legge o la
        sicurezza di qualcuno lo impediscano, e può chiedere di riesaminare la decisione tramite lo stesso modulo.
      </p>

      <h2>Chiusura</h2>
      <p>
        Puoi eliminare il tuo account in qualsiasi momento dalla pagina Account. Il sito può chiudere un account che viola queste condizioni,
        o interrompere il servizio; gli account chiusi vengono eliminati {CLOSED_ACCOUNT_RETENTION_DAYS} giorni dopo.
      </p>

      <h2>Nessuna garanzia</h2>
      <p>
        Il servizio è fornito così com&apos;è, senza garanzia che sia sempre disponibile o privo di errori. Nei limiti consentiti dalla legge,
        il sito non risponde di danni derivanti dal suo utilizzo.
      </p>

      <h2>Modifiche e legge applicabile</h2>
      <p>
        Queste condizioni possono cambiare; la data in alto indica l&apos;ultima modifica. Si applica la legge italiana, fatte salve le tutele
        che la legge del tuo paese ti riconosce come consumatore.
      </p>
    </>
  );
}
