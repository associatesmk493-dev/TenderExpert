ALTER TABLE public.attendance_logs ADD COLUMN check_out_time timestamp with time zone;

CREATE POLICY "Users can update own attendance"
ON public.attendance_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);