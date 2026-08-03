
-- Site content table for editable landing page
CREATE TABLE public.site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL UNIQUE,
  title_ar TEXT,
  title_en TEXT,
  body_ar TEXT,
  body_en TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read published sections
DROP POLICY IF EXISTS site_content_public_read ON public.site_content;
CREATE POLICY site_content_public_read
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Executives can read all (including unpublished)
DROP POLICY IF EXISTS site_content_admin_read_all ON public.site_content;
CREATE POLICY site_content_admin_read_all
  ON public.site_content FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'executive'::app_role));

-- Only executives can write
DROP POLICY IF EXISTS site_content_admin_write ON public.site_content;
CREATE POLICY site_content_admin_write
  ON public.site_content FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'executive'::app_role))
  WITH CHECK (has_role(auth.uid(), 'executive'::app_role));

CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default sections
INSERT INTO public.site_content (section, title_ar, title_en, body_ar, body_en, display_order) VALUES
  ('about', 'نبذة عنّا', 'About Us', 'شركة سكن المجتمع للبحث والتطوير تُعنى بتقديم برامج وخدمات تنموية متكاملة للمجتمع.', 'Sakan Al-Mujtama for Research and Development delivers integrated community development programs and services.', 1),
  ('vision', 'رؤيتنا', 'Our Vision', 'أن نكون رواداً في تطوير المجتمعات المحلية عبر برامج تعليمية وتنموية مبتكرة.', 'To be a leader in developing local communities through innovative educational and development programs.', 2),
  ('mission', 'رسالتنا', 'Our Mission', 'تمكين الأفراد والأسر من خلال برامج عالية الجودة تواكب احتياجاتهم وتطلعاتهم.', 'Empowering individuals and families through high-quality programs that meet their needs and aspirations.', 3),
  ('services', 'خدماتنا وبرامجنا', 'Our Services & Programs', 'نقدّم مجموعة متنوعة من البرامج التدريبية والتطويرية والمجتمعية.', 'We offer a diverse range of training, development, and community programs.', 4);
