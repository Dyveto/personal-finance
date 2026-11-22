import { z } from "zod";

export const SignInSchema = z.object({
  email: z
    .string({ message: "El correo electrónico es obligatorio" })
    .email({ message: "Ingresa un correo electrónico válido" })
    .trim()
    .toLowerCase(),
  password: z
    .string({ message: "La contraseña es obligatoria" })
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
});

export const SignUpSchema = z
  .object({
    email: z
      .string({ message: "El correo electrónico es obligatorio" })
      .email({ message: "Ingresa un correo electrónico válido" })
      .trim()
      .toLowerCase(),
    password: z
      .string({ message: "La contraseña es obligatoria" })
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
      .regex(/[A-Z]/, { message: "La contraseña debe contener al menos una letra mayúscula" })
      .regex(/[a-z]/, { message: "La contraseña debe contener al menos una letra minúscula" })
      .regex(/[0-9]/, { message: "La contraseña debe contener al menos un número" }),
    confirmPassword: z
      .string({ message: "Confirma tu contraseña" })
      .min(8, { message: "La confirmación debe tener al menos 8 caracteres" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
