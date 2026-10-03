/** Content-free invalidation signals for a rebuildable projection, never occupational commands. */
export const localSearchNotifications=`
CREATE TRIGGER wiki_search_insert AFTER INSERT ON wiki_knowledge BEGIN INSERT INTO platform_local_search_dirty VALUES('wiki',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER wiki_search_update AFTER UPDATE ON wiki_knowledge BEGIN INSERT INTO platform_local_search_dirty VALUES('wiki',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER wiki_search_delete AFTER DELETE ON wiki_knowledge BEGIN INSERT INTO platform_local_search_dirty VALUES('wiki',old.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER project_search_insert AFTER INSERT ON project_current BEGIN INSERT INTO platform_local_search_dirty VALUES('project',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER project_search_update AFTER UPDATE ON project_current BEGIN INSERT INTO platform_local_search_dirty VALUES('project',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER project_search_delete AFTER DELETE ON project_current BEGIN INSERT INTO platform_local_search_dirty VALUES('project',old.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER opportunity_search_insert AFTER INSERT ON opportunity_core BEGIN INSERT INTO platform_local_search_dirty VALUES('opportunity',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER opportunity_search_update AFTER UPDATE ON opportunity_core BEGIN INSERT INTO platform_local_search_dirty VALUES('opportunity',new.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER opportunity_search_delete AFTER DELETE ON opportunity_core BEGIN INSERT INTO platform_local_search_dirty VALUES('opportunity',old.id) ON CONFLICT(owner,object_id) DO NOTHING; END;
CREATE TRIGGER company_search_update AFTER UPDATE ON opportunity_company BEGIN INSERT INTO platform_local_search_dirty SELECT 'opportunity',id FROM opportunity_core WHERE company_id=new.id ON CONFLICT(owner,object_id) DO NOTHING; END;
INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'wiki',id FROM wiki_knowledge;
INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'project',id FROM project_current;
INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'opportunity',id FROM opportunity_core;
`;
