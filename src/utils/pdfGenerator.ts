import { jsPDF } from 'jspdf';

export function downloadSkillPassportPDF(passportData: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = passportData.worker;
  const rep = w?.reputation;

  // Header band
  doc.setFillColor(15, 29, 56);
  doc.rect(0, 0, 595, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('KAUSHALSETU DIGITAL SKILL PASSPORT', 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Passport ID: ${passportData.passportCode}   |   Issued: ${String(passportData.issuedAt || '').split('T')[0]}`, 40, 68);

  if (passportData.qrDataUrl) {
    try {
      doc.addImage(passportData.qrDataUrl, 'PNG', 475, 16, 80, 80);
    } catch {
      // Ignore QR embed failure on older browsers
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(w?.name || 'Skilled Professional', 40, 132);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${w?.profile?.category || 'Trade'}  |  ${w?.city || 'India'}  |  ${w?.profile?.experienceYears || 0} Years Experience  |  Expected Wage: INR ${w?.profile?.expectedDailyWage || 750}/day`,
    40,
    152
  );

  // Reputation section
  doc.setDrawColor(226, 232, 240);
  doc.line(40, 170, 555, 170);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Dynamic Reputation Score: ${rep?.overallScore ?? 72.0} / 100`, 40, 196);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Quality: ${rep?.qualityScore ?? 75}%   |   Reliability: ${rep?.reliabilityScore ?? 75}%   |   Punctuality: ${rep?.punctualityScore ?? 75}%   |   Skill Proficiency: ${rep?.skillProficiencyScore ?? 75}%`,
    40,
    214
  );

  // Skills list
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Recorded & Verified Trade Skills', 40, 250);

  let y = 272;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const skills = w?.skills || [];
  if (skills.length === 0) {
    doc.text('- No skills added yet.', 45, y);
    y += 18;
  } else {
    for (const sk of skills) {
      const tag =
        sk.verificationType === 'admin_verified'
          ? 'ADMIN VERIFIED'
          : sk.verificationType === 'assessed'
          ? `AI ASSESSED (${sk.assessmentScore || 85}%)`
          : 'SELF-DECLARED';
      doc.text(`• ${sk.name}  —  ${sk.proficiency}  [${tag}]`, 45, y);
      y += 18;
    }
  }

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Completed Verified Projects', 40, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const projects = passportData.completedProjects || [];
  if (projects.length === 0) {
    doc.text('• Ready for first platform project under Fair Opportunity Mode.', 45, y);
    y += 18;
  } else {
    for (const p of projects.slice(0, 6)) {
      doc.text(
        `• ${p.title} (${p.city}) — Employer: ${p.employerName} — Cert: ${p.completionCertificateCode || 'Verified'}`,
        45,
        y
      );
      y += 18;
    }
  }

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text(`Verify live at: ${passportData.verifyUrl}`, 40, 790);
  doc.save(`${passportData.passportCode}_Skill_Passport.pdf`);
}

export function downloadGeneratedProfilePDF(workerName: string, city: string, generated: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFillColor(15, 29, 56);
  doc.rect(0, 0, 595, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(workerName || 'Skilled Worker Portfolio', 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${generated.headline}  |  ${city}`, 40, 62);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Professional Introduction', 40, 118);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const summaryLines = doc.splitTextToSize(generated.professionalSummary || '', 510);
  doc.text(summaryLines, 40, 138);

  let y = 148 + summaryLines.length * 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Core Trade Skills', 40, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  for (const s of generated.extractedSkills || []) {
    doc.text(`• ${s.name} (${s.proficiency})`, 48, y);
    y += 16;
  }

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Work Portfolio Summary', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const portLines = doc.splitTextToSize(generated.portfolioSummary || '', 510);
  doc.text(portLines, 40, y);

  doc.save(`${(workerName || 'Worker').replace(/\s+/g, '_')}_KaushalSetu_Profile.pdf`);
}

export function downloadWorkAgreementPDF(agreement: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFillColor(15, 29, 56);
  doc.rect(0, 0, 595, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('KAUSHALSETU BILATERAL WORK AGREEMENT', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Agreement Code: ${agreement.agreementCode}   |   Date: ${String(agreement.createdAt || '').split('T')[0]}`, 40, 60);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Employer / Client: ${agreement.employerName}`, 40, 116);
  doc.text(`Skilled Worker: ${agreement.workerName}`, 40, 136);
  doc.text(`Agreed Rate: INR ${agreement.dailyWage}/day  x  ${agreement.durationDays} Estimated Day(s)`, 40, 156);

  doc.setFont('helvetica', 'bold');
  doc.text('Scope of Work', 40, 190);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const scopeLines = doc.splitTextToSize(agreement.workDescription || '', 510);
  doc.text(scopeLines, 40, 208);

  let y = 224 + scopeLines.length * 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Responsibilities & Safety Commitments', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  for (const r of agreement.responsibilities || []) {
    const lines = doc.splitTextToSize(`• ${r}`, 505);
    doc.text(lines, 44, y);
    y += lines.length * 14 + 4;
  }

  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Agreed Terms', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  for (const t of agreement.terms || []) {
    const lines = doc.splitTextToSize(`• ${t}`, 505);
    doc.text(lines, 44, y);
    y += lines.length * 14 + 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Digital Acceptance Status: Accepted by Employer & Worker on KaushalSetu', 40, y + 32);
  doc.save(`${agreement.agreementCode}_Work_Agreement.pdf`);
}

export function downloadCompletionCertificatePDF(project: any) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setDrawColor(15, 29, 56);
  doc.setLineWidth(3);
  doc.rect(24, 24, 794, 547);

  doc.setFillColor(15, 29, 56);
  doc.rect(24, 24, 794, 82, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('KAUSHALSETU DIGITAL WORK COMPLETION CERTIFICATE', 421, 72, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('This certifies that skilled trade professional', 421, 165, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(13, 148, 136);
  doc.text(project.workerName || 'Skilled Professional', 421, 205, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(
    `successfully completed the ${project.category} project "${project.title}" in ${project.city}`,
    421,
    248,
    { align: 'center' }
  );
  doc.text(
    `Confirmed by Employer: ${project.employerName}   |   Duration: ${project.durationDays} Day(s)   |   Rate: INR ${project.agreedDailyWage}/day`,
    421,
    278,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    `Certificate ID: ${project.completionCertificateCode || 'CERT-KS-VERIFIED'}   |   Completion Date: ${String(project.completionConfirmedAt || project.createdAt).split('T')[0]}`,
    421,
    340,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Recorded permanently on the worker’s KaushalSetu Digital Skill Passport & Dynamic Reputation Ledger.', 421, 510, {
    align: 'center',
  });

  doc.save(`${project.completionCertificateCode || 'Project'}_Completion_Certificate.pdf`);
}
