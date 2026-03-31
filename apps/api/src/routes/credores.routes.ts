import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  listGrupos, createGrupo, updateGrupo, deleteGrupo,
  listSubgrupos, createSubgrupo, updateSubgrupo, deleteSubgrupo,
  listCredores, updateCredor, getCredorStats, deleteAllCredores,
  autoClassificarCredoresDiarias, getCredorClassificacao,
  autoClassificarDiariasPorHistorico, autoClassificarCredorDiariaIndividual,
  testeClassificacaoDiaria, listarCredoresParaConfirmarDiarias, confirmarClassificacaoDiariaCredor,
  listarCredoresParaConfirmarPessoal, confirmarClassificacaoPessoalCredor,
} from '../controllers/credores.controller';

const router = Router();

// Endpoint de teste sem autenticação (apenas para desenvolvimento)
router.post('/teste-classificacao', testeClassificacaoDiaria);

router.use(authMiddleware);

router.get('/stats', getCredorStats);
router.get('/', listCredores);
router.get('/:id/classificacao', getCredorClassificacao);
router.get('/confirmar-diarias/listar', listarCredoresParaConfirmarDiarias);
router.get('/confirmar-pessoal/listar', listarCredoresParaConfirmarPessoal);
router.put('/:id', updateCredor);
router.delete('/', deleteAllCredores);
router.post('/auto-classificar-diarias', autoClassificarCredoresDiarias);
router.post('/auto-classificar-diarias-por-historico', autoClassificarDiariasPorHistorico);
router.post('/:id/auto-classificar-diaria', autoClassificarCredorDiariaIndividual);
router.post('/:id/confirmar-classificacao-diaria', confirmarClassificacaoDiariaCredor);
router.post('/:id/confirmar-classificacao-pessoal', confirmarClassificacaoPessoalCredor);

router.get('/grupos', listGrupos);
router.post('/grupos', createGrupo);
router.put('/grupos/:id', updateGrupo);
router.delete('/grupos/:id', deleteGrupo);

router.get('/subgrupos', listSubgrupos);
router.post('/subgrupos', createSubgrupo);
router.put('/subgrupos/:id', updateSubgrupo);
router.delete('/subgrupos/:id', deleteSubgrupo);

export default router;
