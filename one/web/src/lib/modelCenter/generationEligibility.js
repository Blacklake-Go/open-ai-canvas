export function isServerModelGenerationEligible(row) {
  const credits = Number(row?.creditsPrice);
  return Boolean(
    row?.id
    && row.isActive === true
    && row.isVisible === true
    && row.autoRouteEligible === true
    && row.hasWorkingRoute === true
    && Number.isFinite(credits)
    && credits > 0
  );
}
