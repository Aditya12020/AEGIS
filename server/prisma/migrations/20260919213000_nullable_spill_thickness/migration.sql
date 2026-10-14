-- Allow explicit NULL for unavailable oil-thickness measurements.
ALTER TABLE `spill_observations`
  MODIFY `thickness_min_microns` DOUBLE NULL,
  MODIFY `thickness_max_microns` DOUBLE NULL;
