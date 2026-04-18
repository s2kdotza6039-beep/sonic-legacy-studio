CREATE POLICY "Founders can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));