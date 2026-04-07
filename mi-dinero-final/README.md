# Mi Dinero - Finanzas Personales

App de finanzas personales con la regla 50/30/20.
Funciona en celular y computador con datos sincronizados.

## Deploy a Vercel (5 min)

1. Sube este repo a GitHub
2. Ve a [vercel.com](https://vercel.com) y conecta tu cuenta de GitHub
3. Click "Add New Project" > selecciona tu repo
4. En "Environment Variables" agrega:
   - `VITE_SUPABASE_URL` = `https://jkxurecbzwtgwjquysui.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = tu publishable key
5. Click "Deploy"

## Desarrollo local

```bash
cp .env.example .env
# Edita .env con tus credenciales
npm install
npm run dev
```

## Stack
- React + Vite
- Supabase (Auth + Postgres + RLS)
- PWA installable
