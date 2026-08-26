
CREATE TABLE public.attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attendance"
ON public.attendance_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attendance"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE INDEX idx_attendance_date ON public.attendance_logs(date DESC);
CREATE INDEX idx_attendance_user_date ON public.attendance_logs(user_id, date DESC);
