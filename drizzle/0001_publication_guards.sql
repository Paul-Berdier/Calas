-- Shared immutable snapshots retain relational ownership across all domain tables.
ALTER TABLE content_documents ADD CONSTRAINT content_documents_draft_owner_fk
  FOREIGN KEY (id, draft_revision_id) REFERENCES content_revisions(document_id, id)
  DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE content_documents ADD CONSTRAINT content_documents_published_owner_fk
  FOREIGN KEY (id, published_revision_id) REFERENCES content_revisions(document_id, id)
  DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE page_revisions ADD CONSTRAINT page_revisions_owner_fk
  FOREIGN KEY (page_id, id) REFERENCES content_revisions(document_id, id);
--> statement-breakpoint
ALTER TABLE article_revisions ADD CONSTRAINT article_revisions_owner_fk
  FOREIGN KEY (article_id, id) REFERENCES content_revisions(document_id, id);
--> statement-breakpoint
CREATE FUNCTION calas_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Editorial revisions are immutable; create a new revision instead'
    USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER content_revisions_immutable BEFORE UPDATE OR DELETE ON content_revisions
  FOR EACH ROW EXECUTE FUNCTION calas_revision_immutable();
--> statement-breakpoint
CREATE TRIGGER page_revisions_immutable BEFORE UPDATE OR DELETE ON page_revisions
  FOR EACH ROW EXECUTE FUNCTION calas_revision_immutable();
--> statement-breakpoint
CREATE TRIGGER article_revisions_immutable BEFORE UPDATE OR DELETE ON article_revisions
  FOR EACH ROW EXECUTE FUNCTION calas_revision_immutable();
--> statement-breakpoint
CREATE FUNCTION calas_document_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM content_documents WHERE id = NEW.id AND kind::text = ANY(TG_ARGV)) THEN
    RAISE EXCEPTION 'Domain row does not match its editorial document kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pages_kind BEFORE INSERT OR UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION calas_document_kind('home', 'page');
--> statement-breakpoint
CREATE TRIGGER articles_kind BEFORE INSERT OR UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION calas_document_kind('article');
--> statement-breakpoint
CREATE TRIGGER people_kind BEFORE INSERT OR UPDATE ON people FOR EACH ROW EXECUTE FUNCTION calas_document_kind('person');
--> statement-breakpoint
CREATE TRIGGER statistics_kind BEFORE INSERT OR UPDATE ON statistics FOR EACH ROW EXECUTE FUNCTION calas_document_kind('statistic');
--> statement-breakpoint
CREATE TRIGGER categories_kind BEFORE INSERT OR UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION calas_document_kind('category');
--> statement-breakpoint
CREATE TRIGGER site_settings_kind BEFORE INSERT OR UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION calas_document_kind('settings');
