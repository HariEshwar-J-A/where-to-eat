import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import type { Restaurant } from "../types";
import {
  createRestaurant,
  deleteRestaurant,
  fetchRestaurants,
  updateRestaurant,
} from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RestaurantManager({ open, onClose }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadRestaurants();
  }, [open, loadRestaurants]);

  const handleEdit = (restaurant: Restaurant) => {
    setEditing(restaurant);
    setName(restaurant.name);
    setCuisine(restaurant.cuisine);
  };

  const handleSave = async () => {
    if (!name.trim() || !cuisine.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await updateRestaurant(editing.id, name.trim(), cuisine.trim());
      } else {
        await createRestaurant(name.trim(), cuisine.trim());
      }
      await loadRestaurants();
      setEditing(null);
      setName("");
      setCuisine("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this restaurant?")) return;
    setLoading(true);
    try {
      await deleteRestaurant(id);
      await loadRestaurants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setName("");
    setCuisine("");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Restaurants</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Typography variant="h6">Add/Edit Restaurant</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                size="small"
                fullWidth
              />
              <Button onClick={handleSave} disabled={loading} variant="contained">
                {editing ? "Update" : "Add"}
              </Button>
              {editing && (
                <Button onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="h6">Restaurants ({restaurants.length})</Typography>
            <List>
              {restaurants.map((r) => (
                <ListItem key={r.id}>
                  <ListItemText primary={r.name} secondary={r.cuisine} />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => handleEdit(r)} size="small">
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(r.id)} size="small" color="error">
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}