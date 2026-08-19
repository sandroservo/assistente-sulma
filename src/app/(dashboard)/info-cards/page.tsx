/**
 * Página de cadastro dos cards informativos do chat.
 */

import { getSessionOrRedirect } from "@/lib/auth";
import { listInfoCards } from "@/lib/info-cards";
import { InfoCardsManager } from "./ui/InfoCardsManager";

export const dynamic = "force-dynamic";

export default async function InfoCardsPage() {
  const session = await getSessionOrRedirect();
  const cards = await listInfoCards(session.user.organizationId);

  return (
    <div className="p-4 pt-14 md:p-6 md:pt-6 space-y-6 max-w-6xl">
      <InfoCardsManager initialCards={cards} />
    </div>
  );
}
