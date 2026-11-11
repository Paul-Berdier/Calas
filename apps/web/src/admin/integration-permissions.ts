export type Scope =
  "read" | "draft" | "publish" | "outreach" | "send" | "users";
export const permissions: { scope: Scope; label: string }[] = [
  { scope: "read", label: "Consulter les contenus et les statistiques" },
  { scope: "draft", label: "Créer et modifier les brouillons" },
  { scope: "publish", label: "Publier et retirer les contenus du site" },
  { scope: "outreach", label: "Gérer les contacts et les campagnes" },
  { scope: "send", label: "Mettre les campagnes en file d’envoi" },
  { scope: "users", label: "Gérer les utilisateurs" },
];
