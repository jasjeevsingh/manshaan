"""
PDF Report Generator Service.

Generates professional Clinical Insight Reports in PDF format
for clinicians and school districts.
"""

import io
import logging
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    HRFlowable, ListFlowable, ListItem
)

from ..models.assessment import ClinicalInsightReport, DomainScore
from ..models.irt import Domain

logger = logging.getLogger(__name__)


class PDFGenerator:
    """
    Generate professional PDF reports for clinical distribution.
    """
    
    def __init__(self):
        """Initialize PDF styles."""
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
        """Create custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=12,
            textColor=colors.HexColor('#1a365d')
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.HexColor('#2c5282')
        ))
        
        self.styles.add(ParagraphStyle(
            name='Disclaimer',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#e53e3e'),
            spaceBefore=12,
            spaceAfter=12,
            borderWidth=1,
            borderColor=colors.HexColor('#e53e3e'),
            borderPadding=8,
            backColor=colors.HexColor('#fff5f5')
        ))
        
        self.styles.add(ParagraphStyle(
            name='Evidence',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#4a5568'),
            leftIndent=20,
            fontName='Courier'
        ))
    
    def _clean_markdown(self, text: str) -> str:
        """Remove markdown formatting artifacts from text."""
        import re
        # Remove bold/italic markers
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
        text = re.sub(r'\*([^*]+)\*', r'\1', text)      # *italic*
        text = re.sub(r'__([^_]+)__', r'\1', text)      # __bold__
        text = re.sub(r'_([^_]+)_', r'\1', text)        # _italic_
        # Remove markdown headers
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        return text.strip()
    
    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters for PDF."""
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        return text
    
    def generate_report(
        self,
        report: ClinicalInsightReport,
        patient_name: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF bytes from ClinicalInsightReport.
        
        Args:
            report: The clinical insight report data
            patient_name: Optional patient name for header
            
        Returns:
            PDF file as bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        
        story = []
        
        # Title and header
        story.append(Paragraph(
            "Clinical Insight Report",
            self.styles['ReportTitle']
        ))
        story.append(Paragraph(
            f"<b>Manshaan Neurodevelopmental Assessment Platform</b>",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 6))
        
        # Metadata table
        meta_data = [
            ["Report ID:", report.report_id[:8] + "..."],
            ["Session ID:", report.session_id[:8] + "..."],
            ["Generated:", report.generated_at.strftime("%Y-%m-%d %H:%M UTC")],
        ]
        if patient_name:
            meta_data.insert(0, ["Patient:", patient_name])
        
        meta_table = Table(meta_data, colWidths=[1.5*inch, 4*inch])
        meta_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2d3748')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))
        
        # Disclaimer
        story.append(Paragraph(
            f"⚠️ {report.disclaimer}",
            self.styles['Disclaimer']
        ))
        
        story.append(HRFlowable(width="100%", color=colors.HexColor('#e2e8f0')))
        story.append(Spacer(1, 12))
        
        # Domain Scores Section
        story.append(Paragraph("Cognitive Domain Scores", self.styles['SectionHeader']))
        story.append(Paragraph(
            "Scores are presented on an IRT θ scale (mean=0, SD=1) with percentile equivalents.",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 6))
        
        # Domain scores table
        score_data = [["Domain", "Score (θ)", "Percentile", "Classification", "95% CI"]]
        for ds in report.domain_scores:
            domain_name = ds.domain.value.replace("_", " ").title()
            ci = f"[{ds.confidence_interval[0]:.2f}, {ds.confidence_interval[1]:.2f}]"
            score_data.append([
                domain_name,
                f"{ds.theta:.2f}",
                f"{ds.percentile:.0f}%",
                ds.classification,
                ci
            ])
        
        score_table = Table(score_data, colWidths=[1.8*inch, 0.8*inch, 0.9*inch, 1.8*inch, 1.2*inch])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf2f7')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ]))
        story.append(score_table)
        story.append(Spacer(1, 16))
        
        # Differential Insight Section
        story.append(Paragraph("Differential Insight", self.styles['SectionHeader']))
        story.append(Paragraph(
            f"<b>Primary Pattern:</b> {report.differential.primary_pattern}",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 8))
        
        # ASD Indicators - strip markdown artifacts
        story.append(Paragraph("<b>ASD-Consistent Indicators:</b>", self.styles['Normal']))
        asd_items = [
            ListItem(Paragraph(self._clean_markdown(ind), self.styles['Normal']))
            for ind in report.differential.asd_indicators
        ]
        story.append(ListFlowable(asd_items, bulletType='bullet'))
        story.append(Spacer(1, 6))
        
        # ID Indicators - strip markdown artifacts
        story.append(Paragraph("<b>ID-Consistent Indicators:</b>", self.styles['Normal']))
        id_items = [
            ListItem(Paragraph(self._clean_markdown(ind), self.styles['Normal']))
            for ind in report.differential.id_indicators
        ]
        story.append(ListFlowable(id_items, bulletType='bullet'))
        story.append(Spacer(1, 8))
        
        # Confidence
        conf_pct = report.differential.differential_confidence * 100
        story.append(Paragraph(
            f"<b>Differential Confidence:</b> {conf_pct:.0f}%",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 8))
        
        # Clinical Notes
        if report.differential.clinical_notes:
            story.append(Paragraph("<b>Clinical Notes:</b>", self.styles['Normal']))
            story.append(Paragraph(
                self._clean_markdown(report.differential.clinical_notes),
                self.styles['Normal']
            ))
        story.append(Spacer(1, 16))
        
        # Recommended Next Steps Section (NEW)
        story.append(Paragraph("Recommended Next Steps", self.styles['SectionHeader']))
        if report.differential.recommendations:
            rec_items = [
                ListItem(Paragraph(self._clean_markdown(rec), self.styles['Normal']))
                for rec in report.differential.recommendations
            ]
            story.append(ListFlowable(rec_items, bulletType='bullet'))
        else:
            story.append(Paragraph(
                "Complete full assessment for personalized recommendations.",
                self.styles['Normal']
            ))
        story.append(Spacer(1, 16))
        
        # CPT Coding & Reimbursement Section (NEW)
        story.append(Paragraph("Billing & Reimbursement", self.styles['SectionHeader']))
        story.append(Paragraph(
            "<b>CPT Code 96146</b> - Psychological or neuropsychological test administration, "
            "with single automated, standardized instrument via electronic assessment.",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"<b>Session Details:</b> {len(report.domain_scores)} cognitive domains assessed via "
            f"adaptive IRT algorithm. This automated administration qualifies for reimbursement "
            f"under CPT 96146 for psychological testing using automated instruments.",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 16))
        
        
        # Evidence Section
        story.append(Paragraph("Evidence & Transparency", self.styles['SectionHeader']))
        story.append(Paragraph(
            "The following raw data supports the above conclusions (Cures Act Non-Device CDS compliance):",
            self.styles['Normal']
        ))
        story.append(Spacer(1, 6))
        
        if report.irt_calculation_log:
            story.append(Paragraph("<b>IRT Calculation Log:</b>", self.styles['Normal']))
            # Format as code block - show all lines
            log_lines = report.irt_calculation_log.split("\n")
            for line in log_lines:
                if line.strip():  # Skip empty lines
                    story.append(Paragraph(self._escape_html(line), self.styles['Evidence']))
        
        story.append(Spacer(1, 12))
        
        # Evidence summary - clean and format properly
        if report.differential.evidence_summary:
            story.append(Paragraph("<b>Clinical Evidence Summary:</b>", self.styles['Normal']))
            # Clean markdown and format
            evidence_clean = self._clean_markdown(report.differential.evidence_summary)
            # Split into paragraphs for better formatting
            for para in evidence_clean.split("\n\n"):
                if para.strip():
                    story.append(Paragraph(self._escape_html(para.strip()), self.styles['Normal']))
                    story.append(Spacer(1, 6))
        
        # Footer
        story.append(Spacer(1, 24))
        story.append(HRFlowable(width="100%", color=colors.HexColor('#e2e8f0')))
        story.append(Paragraph(
            f"Generated by Manshaan Platform | {datetime.utcnow().strftime('%Y-%m-%d')} | For clinical use only",
            ParagraphStyle(
                name='Footer',
                fontSize=8,
                textColor=colors.HexColor('#a0aec0'),
                alignment=1  # Center
            )
        ))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


# Singleton instance
_pdf_generator: Optional[PDFGenerator] = None


def get_pdf_generator() -> PDFGenerator:
    """Get or create PDF generator singleton."""
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = PDFGenerator()
    return _pdf_generator
