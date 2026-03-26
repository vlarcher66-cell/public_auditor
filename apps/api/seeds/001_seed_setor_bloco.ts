import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('dim_setor').delete();
  await knex('dim_bloco').delete();

  await knex('dim_bloco').insert([
    { descricao: 'MÉDIA E ALTA COMPLEXIDADE' },
    { descricao: 'VIGILÂNCIA SANITÁRIA' },
    { descricao: 'ATENÇÃO BÁSICA' },
    { descricao: 'ASSISTÊNCIA FARMACÊUTICA' },
    { descricao: 'ADMINISTRATIVO' },
    { descricao: 'SAD' },
  ]);

  const blocos = await knex('dim_bloco').select('id', 'descricao');
  const bId = (desc: string) => blocos.find((b: any) => b.descricao === desc)!.id;

  await knex('dim_setor').insert([
    { descricao: 'CEREST',                       fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'VIEP',                         fk_bloco: bId('VIGILÂNCIA SANITÁRIA') },
    { descricao: 'ATENÇÃO BÁSICA - PSF/ UBS',    fk_bloco: bId('ATENÇÃO BÁSICA') },
    { descricao: 'CTA',                          fk_bloco: bId('VIGILÂNCIA SANITÁRIA') },
    { descricao: 'VISA',                         fk_bloco: bId('VIGILÂNCIA SANITÁRIA') },
    { descricao: 'CER II',                       fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'NASF',                         fk_bloco: bId('ATENÇÃO BÁSICA') },
    { descricao: 'CEO',                          fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'PACS',                         fk_bloco: bId('ATENÇÃO BÁSICA') },
    { descricao: 'CAPS',                         fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'FARMÁCIA POPULAR',             fk_bloco: bId('ASSISTÊNCIA FARMACÊUTICA') },
    { descricao: 'SESAU',                        fk_bloco: bId('ADMINISTRATIVO') },
    { descricao: 'HGI',                          fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'DESPESA - EXTRA',              fk_bloco: bId('ADMINISTRATIVO') },
    { descricao: 'ENDEMIAS',                     fk_bloco: bId('VIGILÂNCIA SANITÁRIA') },
    { descricao: 'TFD',                          fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'UPA',                          fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'FARMÁCIA BÁSICA',              fk_bloco: bId('ASSISTÊNCIA FARMACÊUTICA') },
    { descricao: 'CME',                          fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'AMB. PSICOSSOCIAL',            fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'LABORATÓRIO MAC',              fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'CENTRAL DE AMBULÂNCIA',        fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'CEMAC',                        fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'CONSELHO DE SAÚDE',            fk_bloco: bId('ADMINISTRATIVO') },
    { descricao: 'SAÚDE BUCAL',                  fk_bloco: bId('ATENÇÃO BÁSICA') },
    { descricao: 'GRER',                         fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'ASS. FARMACÊUTICA',            fk_bloco: bId('ASSISTÊNCIA FARMACÊUTICA') },
    { descricao: 'CEMUR',                        fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'SAD',                          fk_bloco: bId('SAD') },
    { descricao: 'COMB. GLAUCOMA',               fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'SAMU',                         fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'HAM',                          fk_bloco: bId('ADMINISTRATIVO') },
    { descricao: 'CPN - CENTRO DE PARTO NATURAL', fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'CENTRO DE FISIOTERAPIA',       fk_bloco: bId('MÉDIA E ALTA COMPLEXIDADE') },
    { descricao: 'CCAR',                         fk_bloco: bId('ATENÇÃO BÁSICA') },
  ]);
}
