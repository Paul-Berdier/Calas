import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSeedDocuments,validateSeedDocuments} from '../scripts/content-seed.mjs';

test('le contenu initial conserve les neuf pages et les objets éditables sans faux article',()=>{
 const documents=prepareSeedDocuments();
 assert.equal(documents.length,17);
 assert.equal(documents.filter(document=>document._type==='page').length,9);
 assert.equal(documents.filter(document=>document._type==='article').length,0);
 const diagnostic=documents.find(document=>document.slug?.current==='diagnostic-rps');
 const method=diagnostic.sections.find(section=>section.presentation==='method');
 assert.equal(method.items.length,5);
 assert(method.items.every(item=>item._key&&item._type==='textItem'));
 const home=documents.find(document=>document._type==='homePage');
 assert.equal(home.editorial._type,'homeEditorial');
 assert.equal(home.primaryCta._type,'cta');
 assert(home.statistics.every(reference=>reference._type==='reference'&&documents.some(document=>document._id===reference._ref)));
 assert.deepEqual(prepareSeedDocuments(),documents);
});
test('le précontrôle refuse référence cassée et clés de tableau dupliquées',()=>{
 const brokenReference=structuredClone(prepareSeedDocuments());
 brokenReference.find(document=>document._type==='homePage').statistics[0]._ref='missing';
 assert.throws(()=>validateSeedDocuments(brokenReference),/Référence absente/);
 const duplicateKey=structuredClone(prepareSeedDocuments());
 const reasons=duplicateKey.find(document=>document._type==='homePage').reasons;
 reasons[1]._key=reasons[0]._key;
 assert.throws(()=>validateSeedDocuments(duplicateKey),/clé unique/);
});
