import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';
import { ReportService } from '../services/reportService';

const router = Router();

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const reportNumber = `AEGIS-DOSSIER-${code}`;

    let report = await prisma.report.findFirst({
      where: {
        OR: [{ reportNumber }, { incident: { incidentCode: code } }],
      },
      include: { incident: true },
    });

    if (!report) {
      const reportService = new ReportService();
      report = await reportService.generateDossier(code) as any;
    }

    if (!report) return res.status(404).json({ error: 'Report could not be generated' });

    res.json({
      reportNumber: report.reportNumber,
      incidentCode: code,
      generatedAt: report.generatedAt,
      executiveSummary: report.executiveSummary,
      dossier: JSON.parse(report.legalDossierJson),
      provenanceSummary: report.provenanceSummary,
      status: report.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
