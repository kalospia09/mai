import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/");
    return null;
  }

  const loginForm = useForm({
    defaultValues: { username: "", password: "" },
  });

  const handleLogin = (value: string) => {
    loginMutation.mutate({
      username: `user${value}`,
      password: value
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">WhatsApp Clone</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Select your user:</p>
                <div className="flex justify-center gap-4">
                  <Button
                    type="button"
                    size="lg"
                    className="w-24"
                    onClick={() => handleLogin("1")}
                    disabled={loginMutation.isPending}
                  >
                    User 1
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="w-24"
                    onClick={() => handleLogin("2")}
                    disabled={loginMutation.isPending}
                  >
                    User 2
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}