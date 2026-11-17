-- Dívidas de banco/documento que ficaram sem chave (cópias de duplo clique desfeitas
-- na migração anterior) viram manuais: deixam de ser atualizadas pela fonte e não
-- disputam a chave da dívida original.
UPDATE "dividas"
SET "origem" = 'manual', "fonte" = NULL, "conexaoId" = NULL, "pluggyLoanId" = NULL
WHERE "chave" IS NULL AND "origem" <> 'manual';
