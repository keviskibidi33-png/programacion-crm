-- Execute this SQL in Supabase SQL Editor

-- 1. Fix RLS for anon user (Allows local testing and iframe without explicit login)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon pueden ver programacion') THEN
        CREATE POLICY "Anon pueden ver programacion" ON programacion_servicios FOR SELECT TO anon USING (activo = true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon pueden crear programacion') THEN
        CREATE POLICY "Anon pueden crear programacion" ON programacion_servicios FOR INSERT TO anon WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon pueden actualizar programacion') THEN
        CREATE POLICY "Anon pueden actualizar programacion" ON programacion_servicios FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. Create function for Automatic delayed days calculation
CREATE OR REPLACE FUNCTION calculate_dias_atraso() 
RETURNS TRIGGER AS $$
BEGIN
    -- Logic:
    -- If delivered: entrega_real - fecha_entrega_estimada
    -- If not delivered: today - fecha_entrega_estimada (if today > estimated)
    
    IF NEW.entrega_real IS NOT NULL AND NEW.fecha_entrega_estimada IS NOT NULL THEN
        NEW.dias_atraso_lab := GREATEST(0, (NEW.entrega_real::date - NEW.fecha_entrega_estimada::date));
    ELSIF NEW.fecha_entrega_estimada IS NOT NULL THEN
        IF CURRENT_DATE > NEW.fecha_entrega_estimada THEN
            NEW.dias_atraso_lab := CURRENT_DATE - NEW.fecha_entrega_estimada;
        ELSE
            NEW.dias_atraso_lab := 0;
        END IF;
    ELSE
        NEW.dias_atraso_lab := 0;
    END IF;
    
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger implementation
DROP TRIGGER IF EXISTS trigger_calculate_dias_atraso ON programacion_servicios;
CREATE TRIGGER trigger_calculate_dias_atraso
BEFORE INSERT OR UPDATE ON programacion_servicios
FOR EACH ROW
EXECUTE FUNCTION calculate_dias_atraso();

-- 4. Initial update for existing records
UPDATE programacion_servicios 
SET dias_atraso_lab = dias_atraso_lab 
WHERE activo = true;
