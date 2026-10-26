import { z } from "zod";

export const SAFE_NAME_REGEX = /^[a-zA-Z0-9_.\-@/]+$/;
export const SAFE_SEARCH_REGEX = /^[a-zA-Z0-9_.\-@/ ]+$/;

export const SearchQuerySchema = z
  .string()
  .trim()
  .min(1, { message: "Search query cannot be empty" })
  .max(64, { message: "Search query is too long (max 64 chars)" })
  .regex(SAFE_SEARCH_REGEX, {
    message: "Invalid characters in search query. Only letters, numbers, spaces, -, _, ., @, and / are allowed.",
  });

export const PackageNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Package name cannot be empty" })
  .max(64, { message: "Package name is too long (max 64 chars)" })
  .regex(SAFE_NAME_REGEX, {
    message: "Invalid characters in package name. Only letters, numbers, -, _, ., @, and / are allowed.",
  });

export const ServiceActionSchema = z.object({
  name: PackageNameSchema,
  action: z.enum(["start", "stop", "restart"]),
});

export const ThresholdConfigSchema = z.object({
  cpuThresholdPercent: z.number().min(10).max(100),
  ramThresholdMb: z.number().min(100).max(65536),
  notificationsEnabled: z.boolean(),
  cooldownSeconds: z.number().min(10).max(3600),
});

export function sanitizeAndValidateSearch(query: string): { isValid: boolean; sanitized: string; error?: string } {
  const result = SearchQuerySchema.safeParse(query);
  if (!result.success) {
    return {
      isValid: false,
      sanitized: "",
      error: result.error.errors[0]?.message || "Invalid search input",
    };
  }
  return {
    isValid: true,
    sanitized: result.data,
  };
}

export function sanitizeAndValidatePackage(name: string): { isValid: boolean; sanitized: string; error?: string } {
  const result = PackageNameSchema.safeParse(name);
  if (!result.success) {
    return {
      isValid: false,
      sanitized: "",
      error: result.error.errors[0]?.message || "Invalid package name",
    };
  }
  return {
    isValid: true,
    sanitized: result.data,
  };
}
