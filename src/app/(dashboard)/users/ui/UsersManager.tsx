/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Loader2,
  Shield,
  ShieldCheck,
  User,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UsersManagerProps {
  users: UserData[];
  currentUserId: string;
  currentUserRole: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  AGENT: "Atendente",
  VIEWER: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  AGENT: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-700",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <ShieldCheck className="w-3 h-3" />,
  ADMIN: <Shield className="w-3 h-3" />,
  AGENT: <User className="w-3 h-3" />,
  VIEWER: <Eye className="w-3 h-3" />,
};

export function UsersManager({ users: initialUsers, currentUserId, currentUserRole }: UsersManagerProps) {
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "AGENT",
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "AGENT" });
    setEditingUser(null);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            ...(formData.password && { password: formData.password }),
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...data.user } : u)));
          setIsOpen(false);
          resetForm();
        } else {
          setError(data.error || "Erro ao atualizar usuário.");
        }
      } else {
        if (formData.password.length < 6) {
          setError("A senha deve ter no mínimo 6 caracteres.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (res.ok) {
          setUsers([data.user, ...users]);
          setIsOpen(false);
          resetForm();
        } else {
          setError(data.error || "Erro ao criar usuário. Verifique o email.");
        }
      }
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, active: boolean) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });

      if (res.ok) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, active: !active } : u)));
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      }
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <p className="text-gray-500">Gerencie os usuários da sua organização</p>
        </div>

        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-[#001A5E] hover:bg-[#003080] text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md pb-8">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar usuário" : "Novo usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Altere nome, função ou defina uma nova senha."
                  : "Preencha os dados para adicionar um usuário à organização."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex.: Maria Silva"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  disabled={!!editingUser}
                  required={!editingUser}
                  autoComplete="email"
                />
                {editingUser && (
                  <p className="text-xs text-gray-500">O email não pode ser alterado.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">
                  {editingUser ? "Nova senha (opcional)" : "Senha (mín. 6 caracteres)"}
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "Deixe em branco para manter" : "••••••••"}
                  required={!editingUser}
                  minLength={editingUser ? undefined : 6}
                  autoComplete={editingUser ? "new-password" : "new-password"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role" className="block">
                  Função
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {currentUserRole === "OWNER" && (
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    )}
                    <SelectItem value="AGENT">Atendente</SelectItem>
                    <SelectItem value="VIEWER">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#001A5E] hover:bg-[#003080]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingUser ? (
                    "Salvar alterações"
                  ) : (
                    "Criar usuário"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge className={cn("gap-1", ROLE_COLORS[user.role])}>
                    {ROLE_ICONS[user.role]}
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.active ? "default" : "secondary"}
                    className={user.active ? "bg-green-100 text-green-700" : ""}
                  >
                    {user.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {formatDate(user.lastLoginAt)}
                </TableCell>
                <TableCell className="text-right">
                  {user.id !== currentUserId && user.role !== "OWNER" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(user.id, user.active)}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
