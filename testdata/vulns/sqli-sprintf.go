func getOrder(db *sql.DB, id string) (*Order, error) {
	query := fmt.Sprintf("SELECT * FROM orders WHERE id = %s", id)
	return scanOrder(db.QueryRow(query))
}
